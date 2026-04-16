import re
import sqlite3
from decimal import Decimal, InvalidOperation
from pathlib import Path

from scrapy.exceptions import DropItem


class ValidationPipeline:
    """Validate and normalize product items before database insertion."""

    required_fields = ("name", "price", "sku", "availability")

    def process_item(self, item, spider):
        missing = [field for field in self.required_fields if not item.get(field)]
        if missing:
            raise DropItem(f"Missing required field(s): {', '.join(missing)}")

        item["name"] = self._normalize_text(item["name"])
        item["sku"] = self._normalize_text(item["sku"]).upper()
        item["availability"] = self._normalize_availability(item["availability"])
        item["price"] = str(self._normalize_price(item["price"]))

        if len(item["sku"]) < 3:
            raise DropItem("SKU is too short")

        return item

    def _normalize_text(self, value: str) -> str:
        return " ".join(str(value).split()).strip()

    def _normalize_price(self, raw_price) -> Decimal:
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

    def _normalize_availability(self, raw_availability: str) -> str:
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
    """Store validated products into SQLite with UPSERT on SKU."""

    def __init__(self, db_path: str, table_name: str):
        self.db_path = Path(db_path)
        self.table_name = table_name
        self.connection = None

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            db_path=crawler.settings.get("SQLITE_DB_PATH", "data/products.db"),
            table_name=crawler.settings.get("SQLITE_TABLE_NAME", "products"),
        )

    def open_spider(self, spider):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(self.db_path)
        self.connection.execute("PRAGMA journal_mode=WAL;")
        self.connection.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {self.table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                price NUMERIC NOT NULL,
                availability TEXT NOT NULL,
                source_url TEXT,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        self.connection.commit()

    def close_spider(self, spider):
        if self.connection:
            self.connection.commit()
            self.connection.close()

    def process_item(self, item, spider):
        if not self.connection:
            raise DropItem("SQL connection is not initialized")

        self.connection.execute(
            f"""
            INSERT INTO {self.table_name} (sku, name, price, availability, source_url)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(sku)
            DO UPDATE SET
                name = excluded.name,
                price = excluded.price,
                availability = excluded.availability,
                source_url = excluded.source_url,
                last_seen = CURRENT_TIMESTAMP
            """,
            (
                item["sku"],
                item["name"],
                item["price"],
                item["availability"],
                item.get("source_url"),
            ),
        )
        self.connection.commit()
        return item
