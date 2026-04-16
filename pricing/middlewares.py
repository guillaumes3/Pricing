import random
from typing import Iterable, Optional

from playwright_stealth import stealth_async
from scrapy.exceptions import NotConfigured


class RandomUserAgentMiddleware:
    """Assign a random User-Agent to each request."""

    def __init__(self, user_agents: Iterable[str]):
        self.user_agents = [ua for ua in user_agents if ua]
        if not self.user_agents:
            raise NotConfigured("USER_AGENT_POOL is empty")

    @classmethod
    def from_crawler(cls, crawler):
        return cls(user_agents=crawler.settings.getlist("USER_AGENT_POOL"))

    def process_request(self, request, spider):
        user_agent = random.choice(self.user_agents)
        request.headers["User-Agent"] = user_agent

        if request.meta.get("playwright"):
            context_kwargs = request.meta.setdefault("playwright_context_kwargs", {})
            context_kwargs.setdefault("user_agent", user_agent)


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
