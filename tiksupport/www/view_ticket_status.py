from tiksupport.templates.ticket_context import set_ticket_context

no_cache = 1


def get_context(context):
    return set_ticket_context(context)
