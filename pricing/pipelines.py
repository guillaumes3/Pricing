import os
import re
from decimal import Decimal, InvalidOperation
from typing import Any

import psycopg2
from dotenv import load_dotenv
from scrapy.exceptions import DropItem
from scrapy.exceptions import NotConfigured

load_dotenv()


class ValidationPipeline:
    """Validate and normalize scraped data for price history insertion."""

    required_fields = ("product_id", "competitor_id", "price")

    def process_item(self, item: dict, spider):
        missing = [
            field
            for field in self.required_fields
            if item.get(field) is None or str(item.get(field)).strip() == ""
        ]
        if missing:
            raise DropItem(f"Missing required field(s): {', '.join(missing)}")

        item["product_id"] = self._normalize_positive_int(item["product_id"], "product_id")
        item["competitor_id"] = self._normalize_positive_int(
            item["competitor_id"], "competitor_id"
        )
        item["price"] = self._normalize_price(item["price"])

        source_url = item.get("source_url")
        if source_url is not None:
            item["source_url"] = self._normalize_text(source_url)

        return item

    def _normalize_text(self, value: Any) -> str:
        return " ".join(str(value).split()).strip()

    def _normalize_positive_int(self, raw_value: Any, field_name: str) -> int:
        try:
            value = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise DropItem(f"Invalid {field_name}: {raw_value}") from exc

        if value <= 0:
            raise DropItem(f"{field_name} must be a positive integer")
        return value

    def _normalize_price(self, raw_price: Any) -> Decimal:
        value = str(raw_price).strip().replace("\u00A0", " ")
        cleaned = re.sub(r"[^\d,.-]", "", value)

        if cleaned.count(",") > 0 and cleaned.count(".") > 0:
            if cleaned.rfind(",") > cleaned.rfind("."):
                cleaned = cleaned.replace(".", "").replace(",", ".")
            else:
                cleaned = cleaned.replace(",", "")
        elif cleaned.count(",") > 0:
            cleaned = cleaned.replace(",", ".")

        try:
            decimal_value = Decimal(cleaned)
        except InvalidOperation as exc:
            raise DropItem(f"Invalid price format: {raw_price}") from exc

        if decimal_value < 0:
            raise DropItem("Price must be >= 0")

        return decimal_value.quantize(Decimal("0.01"))


class SQLPipeline:
    """Insert scraped prices into price_history on Supabase/PostgreSQL."""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.connection = None
        self.cursor = None

    @classmethod
    def from_crawler(cls, crawler):
        database_url = os.getenv("SUPABASE_DB_URL")
        if not database_url:
            raise NotConfigured("SUPABASE_DB_URL is not set in environment variables")
        return cls(database_url=database_url)

    def open_spider(self, spider):
        try:
            self.connection = psycopg2.connect(self.database_url)
            self.cursor = self.connection.cursor()
        except Exception as exc:
            spider.logger.error("Supabase/PostgreSQL connection failed: %s", exc)
            raise

    def close_spider(self, spider):
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()

    def process_item(self, item: dict, spider):
        if not self.connection or not self.cursor:
            raise DropItem("PostgreSQL connection is not initialized")

        try:
            self.cursor.execute(
                """
                INSERT INTO price_history (product_id, competitor_id, price)
                VALUES (%s, %s, %s)
                """,
                (
                    item["product_id"],
                    item["competitor_id"],
                    item["price"],
                ),
            )
            self.connection.commit()
        except Exception as exc:
            self.connection.rollback()
            spider.logger.error(
                "Failed to insert price_history row for product_id=%s competitor_id=%s: %s",
                item.get("product_id"),
                item.get("competitor_id"),
                exc,
            )
            raise DropItem("Database insertion failed") from exc

        return item
