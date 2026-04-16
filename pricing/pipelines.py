import os
import re
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

import psycopg2
from dotenv import load_dotenv
from psycopg2 import sql
from scrapy.exceptions import DropItem
from scrapy.exceptions import NotConfigured

# Load environment variables from .env in a secure way.
load_dotenv()


class ValidationPipeline:
    """Validate and normalize product items before database insertion."""

    required_fields = ("name", "price", "sku", "availability")

    def process_item(self, item: dict, spider):
        missing = [field for field in self.required_fields if not item.get(field)]
        if missing:
            raise DropItem(f"Missing required field(s): {', '.join(missing)}")

        item["name"] = self._normalize_text(item["name"])
        item["sku"] = self._normalize_text(item["sku"]).upper()
        item["availability"] = self._normalize_availability(item["availability"])
        item["price"] = self._normalize_price(item["price"])

        if len(item["sku"]) < 3:
            raise DropItem("SKU is too short")

        return item

    def _normalize_text(self, value: Any) -> str:
        return " ".join(str(value).split()).strip()

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
            raise DropItem("Price must be positive")

        return decimal_value.quantize(Decimal("0.01"))

    def _normalize_availability(self, raw_availability: Any) -> str:
        value = self._normalize_text(raw_availability).lower()

        in_stock_signals = ("in stock", "available", "disponible", "en stock")
        out_of_stock_signals = (
            "out of stock",
            "unavailable",
            "rupture",
            "not available",
        )

        if any(signal in value for signal in in_stock_signals):
            return "in_stock"
        if any(signal in value for signal in out_of_stock_signals):
            return "out_of_stock"
        return "unknown"


class SQLPipeline:
    """Store validated products into PostgreSQL with UPSERT on SKU."""

    def __init__(self, database_url: str, table_name: str):
        self.database_url = database_url
        self.table_name = table_name
        self.connection = None
        self.cursor = None

    @classmethod
    def from_crawler(cls, crawler):
        # Mandatory secure loading from env variable (no hardcoded credential).
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise NotConfigured("DATABASE_URL is not set in environment variables")

        table_name = crawler.settings.get("POSTGRES_TABLE_NAME") or crawler.settings.get(
            "SQLITE_TABLE_NAME", "products"
        )

        return cls(database_url=database_url, table_name=table_name)

    def open_spider(self, spider):
        try:
            self.connection = psycopg2.connect(self.database_url)
            self.cursor = self.connection.cursor()
            self._ensure_table_exists()
            self.connection.commit()
        except Exception as exc:
            spider.logger.error("PostgreSQL connection failed: %s", exc)
            raise

    def close_spider(self, spider):
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()

    def process_item(self, item: dict, spider):
        if not self.connection or not self.cursor:
            raise DropItem("PostgreSQL connection is not initialized")

        price = self._safe_decimal(item.get("price"))
        # Strict validation before INSERT to avoid polluted pricing data.
        if price is None or price == Decimal("0.00"):
            spider.logger.warning(
                "DropItem: invalid price detected for sku=%s (price=%s)",
                item.get("sku"),
                item.get("price"),
            )
            raise DropItem("Price is None or equal to 0.00")

        item["price"] = price

        query = sql.SQL(
            """
            INSERT INTO {table} (sku, name, price, availability, source_url)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT(sku)
            DO UPDATE SET
                name = EXCLUDED.name,
                price = EXCLUDED.price,
                availability = EXCLUDED.availability,
                source_url = EXCLUDED.source_url,
                last_seen = CURRENT_TIMESTAMP
            """
        ).format(table=sql.Identifier(self.table_name))

        try:
            self.cursor.execute(
                query,
                (
                    item["sku"],
                    item["name"],
                    item["price"],
                    item["availability"],
                    item.get("source_url"),
                ),
            )
            self.connection.commit()
        except Exception as exc:
            self.connection.rollback()
            spider.logger.error(
                "PostgreSQL INSERT failed for sku=%s: %s", item.get("sku"), exc
            )
            raise DropItem("Database insertion failed") from exc

        return item

    def _safe_decimal(self, value: Any) -> Optional[Decimal]:
        if value is None:
            return None

        try:
            return Decimal(str(value)).quantize(Decimal("0.01"))
        except (InvalidOperation, TypeError, ValueError):
            return None

    def _ensure_table_exists(self):
        create_query = sql.SQL(
            """
            CREATE TABLE IF NOT EXISTS {table} (
                id SERIAL PRIMARY KEY,
                sku TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                price NUMERIC(12, 2) NOT NULL,
                availability TEXT NOT NULL,
                source_url TEXT,
                last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
            """
        ).format(table=sql.Identifier(self.table_name))

        self.cursor.execute(create_query)
