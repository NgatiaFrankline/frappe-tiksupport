import frappe


def get_published_articles(limit_page_length=0, title_query=None):
    filters = {"status": "Published"}
    if title_query:
        filters["title"] = ["like", f"%{title_query}%"]

    articles = frappe.get_all(
        "HD Article",
        filters=filters,
        fields=["name", "title", "category", "views", "published_on", "modified"],
        order_by="views desc, modified desc",
        limit_page_length=limit_page_length,
    )
    category_ids = sorted({article.category for article in articles if article.category})
    categories = {}
    if category_ids:
        categories = {
            category.name: category.category_name
            for category in frappe.get_all(
                "HD Article Category",
                filters={"name": ["in", category_ids]},
                fields=["name", "category_name"],
            )
        }

    for article in articles:
        article.category_name = categories.get(article.category)

    return articles
