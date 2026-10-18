import frappe

from tiksupport.templates.ticket_context import set_ticket_context

no_cache = 1


def get_context(context):
    set_ticket_context(context)
    context.ticket_types = frappe.get_all(
        "HD Ticket Type",
        filters={"disabled": 0},
        pluck="name",
        order_by="name asc",
        ignore_permissions=True,
    )
    return context
