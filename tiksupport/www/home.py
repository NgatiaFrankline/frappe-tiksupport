from tiksupport.knowledge_base import get_published_articles
from tiksupport.templates.ticket_context import set_ticket_context

no_cache = 1


def get_context(context):
    context = set_ticket_context(context)
    context.knowledge_articles = get_published_articles(limit_page_length=10)
    return context
