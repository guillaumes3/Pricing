BOT_NAME = "pricing"

SPIDER_MODULES = ["pricing.spiders"]
NEWSPIDER_MODULE = "pricing.spiders"

ROBOTSTXT_OBEY = False

CONCURRENT_REQUESTS = 8
DOWNLOAD_DELAY = 0.5
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1.0
AUTOTHROTTLE_MAX_DELAY = 20.0
AUTOTHROTTLE_TARGET_CONCURRENCY = 4.0

DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
}

USER_AGENT_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

DOWNLOADER_MIDDLEWARES = {
    "pricing.middlewares.RandomUserAgentMiddleware": 400,
    "pricing.middlewares.PlaywrightStealthMiddleware": 550,
}

ITEM_PIPELINES = {
    "pricing.pipelines.ValidationPipeline": 300,
    "pricing.pipelines.SQLPipeline": 400,
}

DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}

TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
PLAYWRIGHT_BROWSER_TYPE = "chromium"
PLAYWRIGHT_LAUNCH_OPTIONS = {"headless": True}
PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT = 30 * 1000
PLAYWRIGHT_STEALTH_ENABLED = True

SQLITE_DB_PATH = "data/products.db"
SQLITE_TABLE_NAME = "products"

# Example target URLs. Replace with your real product page URLs.
PRODUCT_URLS = [
    "https://example.com/product-1",
]

# CSS selector priorities used by the spider for robust extraction.
PRODUCT_SELECTORS = {
    "name": ["h1::text", "meta[property='og:title']::attr(content)"],
    "price": [".price::text", "[itemprop='price']::attr(content)"],
    "sku": [".sku::text", "[itemprop='sku']::text"],
    "availability": [
        ".availability::text",
        "[itemprop='availability']::attr(content)",
    ],
}
