import os
from typing import Optional

import psycopg2
import scrapy
from dotenv import load_dotenv
from psycopg2 import sql

from pricing.items import ProductItem


class ProductSpider(scrapy.Spider):
    name = "products"

    URL_COLUMN_CANDIDATES = (
        "target_url",
        "url",
        "source_url",
        "competitor_url",
        "product_url",
    )

    def start_requests(self):
        load_dotenv()

        connection = None
        cursor = None
        db_targets = []

        try:
            connection = self._open_db_connection()
            if connection is None:
                return

            cursor = connection.cursor()
            url_column = self._detect_url_column(cursor)
            if not url_column:
                return

            query = sql.SQL(
                """
                SELECT
                    pcl.{url_column} AS target_url,
                    pcl.product_id,
                    pcl.competitor_id
                FROM product_competitor_links AS pcl
                INNER JOIN products AS p
                    ON p.id = pcl.product_id
                INNER JOIN competitors AS c
                    ON c.id = pcl.competitor_id
                WHERE pcl.is_active = TRUE
                  AND c.is_active = TRUE
                  AND pcl.{url_column} IS NOT NULL
                  AND TRIM(pcl.{url_column}) <> ''
                ORDER BY pcl.product_id, pcl.competitor_id
                """
            ).format(url_column=sql.Identifier(url_column))

            cursor.execute(query)
            rows = cursor.fetchall()
            db_targets = [
                {
                    "url": row[0],
                    "product_id": row[1],
                    "competitor_id": row[2],
                }
                for row in rows
            ]
            self.logger.info(
                "Loaded %d active target URL(s) from product_competitor_links.",
                len(db_targets),
            )
        except Exception as exc:
            self.logger.error(
                "Failed to load target URLs from PostgreSQL: %s", exc, exc_info=True
            )
            return
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

        for target in db_targets:
            yield scrapy.Request(
                url=target["url"],
                callback=self.parse,
                errback=self.errback,
                meta={
                    "product_id": target["product_id"],
                    "competitor_id": target["competitor_id"],
                    "playwright": True,
                    "playwright_include_page": False,
                    "use_stealth": True,
                },
                dont_filter=True,
            )

    def parse(self, response):
        selectors = self.settings.getdict("PRODUCT_SELECTORS")

        product_id = response.meta.get("product_id")
        competitor_id = response.meta.get("competitor_id")

        item = ProductItem()
        item["name"] = self._extract_first(response, selectors.get("name", []))
        item["price"] = self._extract_first(response, selectors.get("price", []))
        item["sku"] = self._extract_first(response, selectors.get("sku", []))
        item["availability"] = self._extract_first(
            response, selectors.get("availability", [])
        )
        item["source_url"] = response.url

        self.logger.debug(
            "Parsed URL for product_id=%s competitor_id=%s (%s)",
            product_id,
            competitor_id,
            response.url,
        )

        yield item

    def _open_db_connection(self):
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            return psycopg2.connect(database_url)

        db_config = {
            "host": os.getenv("DB_HOST"),
            "port": os.getenv("DB_PORT", "5432"),
            "user": os.getenv("DB_USER"),
            "password": os.getenv("DB_PASSWORD"),
            "dbname": os.getenv("DB_NAME"),
        }
        missing = [key for key, value in db_config.items() if not value]
        if missing:
            self.logger.error(
                "Missing DB environment variables: %s", ", ".join(missing)
            )
            return None

        ssl_mode = "require" if self._is_truthy(os.getenv("DB_SSL")) else "prefer"
        db_config["sslmode"] = ssl_mode
        return psycopg2.connect(**db_config)

    def _detect_url_column(self, cursor) -> Optional[str]:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'product_competitor_links'
            """
        )
        available_columns = {row[0] for row in cursor.fetchall()}

        for candidate in self.URL_COLUMN_CANDIDATES:
            if candidate in available_columns:
                return candidate

        self.logger.error(
            "No supported URL column found in product_competitor_links. Tried: %s",
            ", ".join(self.URL_COLUMN_CANDIDATES),
        )
        return None

    def _is_truthy(self, value) -> bool:
        return str(value or "").strip().lower() in {"1", "true", "yes", "on"}

    def _extract_first(self, response, css_selectors):
        for selector in css_selectors:
            value = response.css(selector).get()
            if value:
                return " ".join(value.split()).strip()
        return None

    def errback(self, failure):
        request = failure.request
        self.logger.error("Request failed for %s: %s", request.url, failure.value)
