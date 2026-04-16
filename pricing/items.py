import scrapy


class ProductItem(scrapy.Item):
    name = scrapy.Field()
    price = scrapy.Field()
    sku = scrapy.Field()
    availability = scrapy.Field()
    source_url = scrapy.Field()
