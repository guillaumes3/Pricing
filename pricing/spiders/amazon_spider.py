import re
from typing import Optional
from urllib.parse import urlparse

import scrapy
from pydantic import BaseModel, HttpUrl, PositiveFloat, ValidationError


class ProductPriceSchema(BaseModel):
    """Validate extracted product pricing data."""

    name: str
    price: PositiveFloat
    source_url: HttpUrl


class AmazonSpider(scrapy.Spider):
    name = "amazon"
    allowed_domains = ["amazon.com", "www.amazon.com", "amazon.fr", "www.amazon.fr"]

    custom_settings = {
        "DOWNLOAD_HANDLERS": {
            "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
            "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
        },
        "TWISTED_REACTOR": "twisted.internet.asyncioreactor.AsyncioSelectorReactor",
        "DOWNLOADER_MIDDLEWARES": {
            "pricing.middlewares.RandomUserAgentMiddleware": 400,
            "pricing.middlewares.HumanJitterMiddleware": 500,
            "pricing.middlewares.PlaywrightStealthMiddleware": 550,
            "pricing.middlewares.ProxyBackoffRetryMiddleware": 560,
        },
        "RETRY_ENABLED": False,
        "PLAYWRIGHT_STEALTH_ENABLED": True,
        "PLAYWRIGHT_BROWSER_TYPE": "chromium",
        "PLAYWRIGHT_LAUNCH_OPTIONS": {
            "headless": True,
            # Helps reduce automation fingerprints.
            "args": ["--disable-blink-features=AutomationControlled"],
        },
        "HUMAN_JITTER_MIN_SECONDS": 1.5,
        "HUMAN_JITTER_MAX_SECONDS": 4.0,
        "ANTIBAN_RETRY_HTTP_CODES": [403, 429, 503],
        "ANTIBAN_MAX_RETRIES": 3,
        "ANTIBAN_BACKOFF_BASE_SECONDS": 1.5,
    }

    def start_requests(self):
        urls = self.settings.getlist("AMAZON_PRODUCT_URLS") or self.settings.getlist(
            "PRODUCT_URLS"
        )
        if not urls:
            self.logger.error(
                "No URLs configured. Set AMAZON_PRODUCT_URLS (or PRODUCT_URLS)."
            )
            return

        for url in urls:
            yield scrapy.Request(
                url=url,
                callback=self.parse_product,
                errback=self.errback,
                meta={
                    "playwright": True,
                    "playwright_include_page": False,
                    "use_stealth": True,
                },
                dont_filter=True,
            )

    def parse_product(self, response):
        name = self._extract_first(
            response,
            [
                "#productTitle::text",
                "meta[property='og:title']::attr(content)",
            ],
        )
        raw_price = self._extract_first(
            response,
            [
                ".a-price.aok-align-center .a-offscreen::text",
                ".apexPriceToPay .a-offscreen::text",
                "#priceblock_ourprice::text",
                "#priceblock_dealprice::text",
                ".a-price .a-offscreen::text",
            ],
        )
        price = self._parse_price(raw_price)
        sku = self._extract_first(response, ["#ASIN::attr(value)"]) or self._extract_asin(
            response.url
        )
        availability = self._extract_first(
            response, ["#availability span::text", "#availability::text"]
        )

        payload = {
            "name": name or "",
            "price": price,
            "source_url": response.url,
        }

        try:
            validated = self._validate_payload(payload)
        except ValidationError as exc:
            self.logger.error(
                "Pydantic validation failed for %s: %s", response.url, exc.errors()
            )
            return

        yield {
            "name": validated.name.strip(),
            "price": float(validated.price),
            "sku": (sku or "UNKNOWN-ASIN").strip().upper(),
            "availability": (availability or "unknown").strip(),
            "source_url": str(validated.source_url),
        }

    def _extract_first(self, response, selectors: list[str]) -> Optional[str]:
        for selector in selectors:
            value = response.css(selector).get()
            if value:
                return " ".join(value.split()).strip()
        return None

    def _parse_price(self, raw_price: Optional[str]) -> Optional[float]:
        if not raw_price:
            return None

        cleaned = str(raw_price).replace("\u00A0", " ").strip()
        cleaned = re.sub(r"[^\d,.\s]", "", cleaned).replace(" ", "")

        if "," in cleaned and "." in cleaned:
            if cleaned.rfind(",") > cleaned.rfind("."):
                cleaned = cleaned.replace(".", "").replace(",", ".")
            else:
                cleaned = cleaned.replace(",", "")
        elif "," in cleaned:
            cleaned = cleaned.replace(",", ".")

        try:
            return float(cleaned)
        except ValueError:
            return None

    def _extract_asin(self, url: str) -> Optional[str]:
        match = re.search(r"/(?:dp|gp/product)/([A-Z0-9]{10})", url.upper())
        if match:
            return match.group(1)

        path = urlparse(url).path.upper()
        match = re.search(r"/([A-Z0-9]{10})(?:[/?]|$)", path)
        if match:
            return match.group(1)
        return None

    def _validate_payload(self, payload: dict) -> ProductPriceSchema:
        # pydantic v2
        if hasattr(ProductPriceSchema, "model_validate"):
            return ProductPriceSchema.model_validate(payload)
        # pydantic v1 fallback
        return ProductPriceSchema.parse_obj(payload)

    def errback(self, failure):
        request = failure.request
        self.logger.error("Request failed for %s: %s", request.url, failure.value)
