import frappe
from frappe.core.doctype.doctype.doctype import validate_permissions_for_doctype
from frappe.permissions import add_permission, update_permission_property


def execute():
    permission = {
        "parent": "HD Ticket",
        "role": "Guest",
        "permlevel": 0,
        "if_owner": 0,
    }
    if not frappe.db.exists("Custom DocPerm", permission):
        add_permission("HD Ticket", "Guest", ptype="create")

    rights = {
        "select": 0,
        "read": 1,
        "write": 0,
        "create": 1,
        "delete": 0,
        "submit": 0,
        "cancel": 0,
        "amend": 0,
        "report": 0,
        "export": 0,
        "import": 0,
        "share": 0,
        "print": 0,
        "email": 0,
    }
    for permission_type, value in rights.items():
        update_permission_property(
            "HD Ticket",
            "Guest",
            0,
            permission_type,
            value=value,
            validate=False,
        )

    validate_permissions_for_doctype("HD Ticket")
