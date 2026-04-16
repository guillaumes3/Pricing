import random
from typing import Iterable, Optional

from fake_useragent import FakeUserAgentError, UserAgent
from playwright_stealth import stealth_async
from scrapy.exceptions import NotConfigured
from twisted.internet import reactor
from twisted.internet.task import deferLater


class RandomUserAgentMiddleware:
    """Rotate User-Agents dynamically with fake_useragent."""

    def __init__(self, fallback_user_agents: Iterable[str]):
        self.fallback_user_agents = [ua for ua in fallback_user_agents if ua]
        self.user_agent_provider = UserAgent()

    @classmethod
    def from_crawler(cls, crawler):
        return cls(fallback_user_agents=crawler.settings.getlist("USER_AGENT_POOL"))

    def process_request(self, request, spider):
        user_agent = self._get_dynamic_user_agent(spider)
        request.headers["User-Agent"] = user_agent

        if request.meta.get("playwright"):
            context_kwargs = request.meta.setdefault("playwright_context_kwargs", {})
            context_kwargs["user_agent"] = user_agent

    def _get_dynamic_user_agent(self, spider) -> str:
        try:
            return self.user_agent_provider.random
        except FakeUserAgentError as exc:
            spider.logger.warning(
                "fake_useragent unavailable, fallback pool used: %s", exc
            )

        if self.fallback_user_agents:
            return random.choice(self.fallback_user_agents)

        # Safe final fallback to keep crawl running if every provider fails.
        return (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )


class PlaywrightStealthMiddleware:
    """Attach playwright-stealth when a request is handled by Playwright."""

    @classmethod
    def from_crawler(cls, crawler):
        if not crawler.settings.getbool("PLAYWRIGHT_STEALTH_ENABLED", True):
            raise NotConfigured("PLAYWRIGHT_STEALTH_ENABLED is False")
        return cls()

    def process_request(self, request, spider):
        if not request.meta.get("playwright"):
            return None

        use_stealth = request.meta.get("use_stealth", True)
        if use_stealth and "playwright_page_init_callback" not in request.meta:
            request.meta["playwright_page_init_callback"] = self._apply_stealth
        return None

    async def _apply_stealth(self, page, request: Optional[object] = None):
        await stealth_async(page)


class HumanJitterMiddleware:
    """Add human-like random delays before each request."""

    def __init__(self, min_delay: float, max_delay: float):
        if min_delay < 0 or max_delay <= 0 or min_delay > max_delay:
            raise NotConfigured("Invalid HUMAN_JITTER_MIN_SECONDS/HUMAN_JITTER_MAX_SECONDS")
        self.min_delay = min_delay
        self.max_delay = max_delay

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            min_delay=crawler.settings.getfloat("HUMAN_JITTER_MIN_SECONDS", 1.5),
            max_delay=crawler.settings.getfloat("HUMAN_JITTER_MAX_SECONDS", 4.0),
        )

    def process_request(self, request, spider):
        delay = random.uniform(self.min_delay, self.max_delay)
        return deferLater(reactor, delay, lambda: None)


class ProxyBackoffRetryMiddleware:
    """Retry anti-ban responses with proxy rotation and exponential backoff."""

    def __init__(
        self,
        retry_http_codes: Iterable[int],
        max_retries: int,
        backoff_base_seconds: float,
        proxy_pool: Iterable[str],
    ):
        self.retry_http_codes = {int(code) for code in retry_http_codes}
        self.max_retries = max_retries
        self.backoff_base_seconds = backoff_base_seconds
        self.proxy_pool = [proxy.strip() for proxy in proxy_pool if str(proxy).strip()]

        if not self.retry_http_codes:
            raise NotConfigured("ANTIBAN_RETRY_HTTP_CODES is empty")
        if self.max_retries <= 0:
            raise NotConfigured("ANTIBAN_MAX_RETRIES must be greater than 0")

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            retry_http_codes=crawler.settings.getlist(
                "ANTIBAN_RETRY_HTTP_CODES", [403, 429, 503]
            ),
            max_retries=crawler.settings.getint("ANTIBAN_MAX_RETRIES", 3),
            backoff_base_seconds=crawler.settings.getfloat(
                "ANTIBAN_BACKOFF_BASE_SECONDS", 1.5
            ),
            proxy_pool=crawler.settings.getlist("PROXY_POOL"),
        )

    def process_request(self, request, spider):
        if request.meta.get("proxy"):
            return None

        proxy = self._pick_proxy(current_proxy=None)
        if proxy:
            request.meta["proxy"] = proxy
        return None

    def process_response(self, request, response, spider):
        if response.status not in self.retry_http_codes:
            return response

        retry_request, retry_count, delay = self._build_retry_request(
            request=request,
            spider=spider,
            reason=f"HTTP {response.status}",
        )
        if retry_request is None:
            return response

        spider.logger.warning(
            "Anti-ban retry %s/%s for %s after %s (proxy=%s, backoff=%.2fs)",
            retry_count,
            self.max_retries,
            request.url,
            response.status,
            retry_request.meta.get("proxy", "none"),
            delay,
        )
        return deferLater(reactor, delay, lambda: retry_request)

    def process_exception(self, request, exception, spider):
        retry_request, retry_count, delay = self._build_retry_request(
            request=request,
            spider=spider,
            reason=str(exception),
        )
        if retry_request is None:
            return None

        spider.logger.warning(
            "Anti-ban retry %s/%s for %s after exception=%s (proxy=%s, backoff=%.2fs)",
            retry_count,
            self.max_retries,
            request.url,
            exception,
            retry_request.meta.get("proxy", "none"),
            delay,
        )
        return deferLater(reactor, delay, lambda: retry_request)

    def _build_retry_request(self, request, spider, reason: str):
        retry_count = int(request.meta.get("antiban_retry_times", 0)) + 1
        if retry_count > self.max_retries:
            spider.logger.error(
                "Max anti-ban retries reached for %s (reason=%s)", request.url, reason
            )
            return None, retry_count, 0.0

        delay = self.backoff_base_seconds * (2 ** (retry_count - 1))

        retry_request = request.copy()
        retry_request.dont_filter = True
        retry_request.meta["antiban_retry_times"] = retry_count
        retry_request.meta["download_timeout"] = max(
            request.meta.get("download_timeout", 30), 30
        )

        current_proxy = request.meta.get("proxy")
        new_proxy = self._pick_proxy(current_proxy=current_proxy)
        if new_proxy:
            retry_request.meta["proxy"] = new_proxy
        elif current_proxy:
            # Keep the current proxy only when no alternative is available.
            retry_request.meta["proxy"] = current_proxy

        return retry_request, retry_count, delay

    def _pick_proxy(self, current_proxy: Optional[str]) -> Optional[str]:
        if not self.proxy_pool:
            return None

        candidates = [proxy for proxy in self.proxy_pool if proxy != current_proxy]
        if not candidates:
            candidates = self.proxy_pool
        return random.choice(candidates)
