import frappe
from frappe import _

from tiksupport.templates.ticket_context import set_ticket_context

no_cache = 1


def get_context(context):
    context = set_ticket_context(context)
    article_name = frappe.form_dict.get("article")
    if not article_name:
        frappe.throw(_("Knowledge base article not found"), frappe.DoesNotExistError)

    article = frappe.db.get_value(
        "HD Article",
        {"name": article_name, "status": "Published"},
        ["name", "title", "content", "category", "views", "published_on"],
        as_dict=True,
    )
    if not article:
        frappe.throw(_("Knowledge base article not found"), frappe.DoesNotExistError)

    article.content = frappe.utils.sanitize_html(article.content or "", always_sanitize=True)
    article.category_name = (
        frappe.db.get_value("HD Article Category", article.category, "category_name")
        if article.category
        else None
    )
    article.published_date = (
        frappe.utils.formatdate(article.published_on) if article.published_on else None
    )
    context.article = article
    return context
