import os
import json
import re

import psycopg2
import scrapy
from dotenv import load_dotenv

load_dotenv()


class ProductSpider(scrapy.Spider):
    name = "products"

    LINKS_QUERY = """
    SELECT l.target_url, l.product_id, l.competitor_id
    FROM product_competitor_links l
    WHERE l.is_active = TRUE;
    """

    PRICE_META_SELECTORS = (
        "meta[property='product:price:amount']::attr(content)",
        "meta[name='product:price:amount']::attr(content)",
        "meta[property='og:price:amount']::attr(content)",
        "meta[property='og:price:standard_amount']::attr(content)",
        "meta[property='twitter:data1']::attr(content)",
        "meta[itemprop='price']::attr(content)",
        "[itemprop='price']::attr(content)",
    )

    AMOUNT_WITH_CURRENCY_PATTERN = r"""
        (?P<amount>
            €\s*\d{1,3}(?:[\s\u00A0.,]\d{3})*(?:[.,]\d{1,2})?
            |
            \d{1,3}(?:[\s\u00A0.,]\d{3})*(?:[.,]\d{1,2})?\s*(?:€|EUR)\b
            |
            €\s*\d+(?:[.,]\d{1,2})?
            |
            \d+(?:[.,]\d{1,2})?\s*(?:€|EUR)\b
        )
    """
    KEYWORD_PRICE_REGEX = re.compile(
        rf"\b(?:prix|price)\b[\s\S]{{0,120}}?{AMOUNT_WITH_CURRENCY_PATTERN}",
        re.IGNORECASE | re.VERBOSE,
    )
    CURRENCY_PRICE_REGEX = re.compile(
        AMOUNT_WITH_CURRENCY_PATTERN, re.IGNORECASE | re.VERBOSE
    )

    NUMBER_ONLY_REGEX = re.compile(r"^\d[\d\s\u00A0.,]*$")

    def start_requests(self):
        database_url = os.getenv("SUPABASE_DB_URL")
        if not database_url:
            self.logger.error("SUPABASE_DB_URL is not set.")
            return

        rows = []
        connection = None

        try:
            connection = psycopg2.connect(database_url)
            with connection.cursor() as cursor:
                cursor.execute(self.LINKS_QUERY)
                rows = cursor.fetchall()
        except Exception as exc:
            self.logger.error(
                "Failed to load active links from product_competitor_links: %s",
                exc,
                exc_info=True,
            )
            return
        finally:
            if connection is not None:
                connection.close()

        self.logger.info("Loaded %d active link(s) to scrape.", len(rows))

        for target_url, product_id, competitor_id in rows:
            if not target_url:
                self.logger.warning(
                    "Skipping empty target_url for product_id=%s competitor_id=%s",
                    product_id,
                    competitor_id,
                )
                continue

            yield scrapy.Request(
                url=target_url,
                callback=self.parse,
                errback=self.errback,
                dont_filter=True,
                meta={
                    "product_id": product_id,
                    "competitor_id": competitor_id,
                    "playwright": True,
                    "playwright_include_page": False,
                },
            )

    def parse(self, response):
        price = self._extract_price(response)
        if price is None:
            self.logger.warning(
                "No price found for product_id=%s competitor_id=%s url=%s",
                response.meta.get("product_id"),
                response.meta.get("competitor_id"),
                response.url,
            )

        yield {
            "product_id": response.meta.get("product_id"),
            "competitor_id": response.meta.get("competitor_id"),
            "price": price,
            "source_url": response.url,
        }

    def _extract_price(self, response):
        extractors = (
            self._extract_from_meta_tags,
            self._extract_from_json_ld,
            self._extract_from_regex,
        )
        for extractor in extractors:
            price = extractor(response)
            if price:
                return price
        return None

    def _extract_from_meta_tags(self, response):
        for selector in self.PRICE_META_SELECTORS:
            raw_value = response.css(selector).get()
            normalized = self._normalize_value(raw_value)
            if normalized and self._is_price_candidate(normalized):
                return normalized
        return None

    def _extract_from_json_ld(self, response):
        json_ld_scripts = response.css("script[type*='ld+json']::text").getall()

        for raw_script in json_ld_scripts:
            parsed = self._safe_json_load(raw_script)
            if parsed is None:
                continue

            nodes = list(self._iter_json_nodes(parsed))
            for node in nodes:
                if self._is_product_like(node):
                    price = self._extract_price_from_json_node(node)
                    if price:
                        return price

            for node in nodes:
                price = self._extract_price_from_json_node(node)
                if price:
                    return price
        return None

    def _extract_from_regex(self, response):
        text_content = " ".join(response.css("body *::text").getall())
        normalized_text = self._normalize_value(text_content)
        if not normalized_text:
            return None

        keyword_match = self.KEYWORD_PRICE_REGEX.search(normalized_text)
        if keyword_match:
            return self._normalize_value(keyword_match.group("amount"))

        currency_match = self.CURRENCY_PRICE_REGEX.search(normalized_text)
        if currency_match:
            return self._normalize_value(currency_match.group("amount"))

        return None

    def _safe_json_load(self, raw_script):
        if not raw_script:
            return None

        script_text = raw_script.strip()
        try:
            return json.loads(script_text)
        except json.JSONDecodeError:
            if script_text.endswith(";"):
                try:
                    return json.loads(script_text[:-1])
                except json.JSONDecodeError:
                    return None
            return None

    def _iter_json_nodes(self, value):
        if isinstance(value, dict):
            yield value
            for nested in value.values():
                yield from self._iter_json_nodes(nested)
        elif isinstance(value, list):
            for item in value:
                yield from self._iter_json_nodes(item)

    def _is_product_like(self, node):
        node_type = node.get("@type")
        if isinstance(node_type, str):
            types = [node_type]
        elif isinstance(node_type, list):
            types = [str(item) for item in node_type]
        else:
            types = []

        product_markers = ("product", "offer", "aggregateoffer")
        return any(
            any(marker in type_value.lower() for marker in product_markers)
            for type_value in types
        )

    def _extract_price_from_json_node(self, node):
        for key in ("price", "lowPrice", "highPrice"):
            candidate = self._coerce_price(node.get(key))
            if candidate:
                return candidate

        for key in ("offers", "priceSpecification"):
            nested = node.get(key)
            candidate = self._coerce_nested_price(nested)
            if candidate:
                return candidate

        return None

    def _coerce_nested_price(self, value):
        if isinstance(value, list):
            for item in value:
                candidate = self._coerce_nested_price(item)
                if candidate:
                    return candidate
            return None

        if isinstance(value, dict):
            return self._extract_price_from_json_node(value)

        return self._coerce_price(value)

    def _coerce_price(self, value):
        if value is None:
            return None

        if isinstance(value, (int, float)):
            return str(value)

        if isinstance(value, str):
            normalized = self._normalize_value(value)
            if normalized and self._is_price_candidate(normalized):
                return normalized

        return None

    def _is_price_candidate(self, value):
        if not value:
            return False
        if "€" in value or "eur" in value.lower():
            return True
        return bool(self.NUMBER_ONLY_REGEX.match(value))

    def _normalize_value(self, value):
        if value is None:
            return None
        normalized = " ".join(str(value).split()).strip()
        return normalized or None

    def errback(self, failure):
        request = failure.request
        self.logger.error(
            "Request failed for product_id=%s competitor_id=%s url=%s: %s",
            request.meta.get("product_id"),
            request.meta.get("competitor_id"),
            request.url,
            failure.value,
        )
