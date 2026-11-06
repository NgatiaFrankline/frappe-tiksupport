import frappe

from tiksupport.knowledge_base import get_published_articles
from tiksupport.templates.ticket_context import set_ticket_context

no_cache = 1


def get_context(context):
    context = set_ticket_context(context)
    context.search_query = (frappe.form_dict.get("q") or "").strip()[:100]
    context.articles = get_published_articles(title_query=context.search_query)
    context.article_count = len(context.articles)
    return context
