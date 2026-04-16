import scrapy

from pricing.items import ProductItem


class ProductSpider(scrapy.Spider):
    name = "products"

    def start_requests(self):
        urls = self.settings.getlist("PRODUCT_URLS")
        if not urls:
            self.logger.warning("No URLs configured in PRODUCT_URLS")
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
            )

    def parse_product(self, response):
        selectors = self.settings.getdict("PRODUCT_SELECTORS")

        item = ProductItem()
        item["name"] = self._extract_first(response, selectors.get("name", []))
        item["price"] = self._extract_first(response, selectors.get("price", []))
        item["sku"] = self._extract_first(response, selectors.get("sku", []))
        item["availability"] = self._extract_first(
            response, selectors.get("availability", [])
        )
        item["source_url"] = response.url

        yield item

    def _extract_first(self, response, css_selectors):
        for selector in css_selectors:
            value = response.css(selector).get()
            if value:
                return " ".join(value.split()).strip()
        return None

    def errback(self, failure):
        request = failure.request
        self.logger.error("Request failed for %s: %s", request.url, failure.value)
