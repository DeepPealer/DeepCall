"""
Permission Bitmask System for DeepCall

Uses bitwise operations for fast permission checks.
Each permission is a power of 2, allowing combinations via OR.

Example:
    user_perms = Permission.KICK_MEMBERS | Permission.TIMEOUT_MEMBERS
    if has_permission(user_perms, Permission.KICK_MEMBERS):
        # User can kick
"""


class Permission:
    """Bitmask constants for permissions"""
    
    # Administrative
    ADMINISTRATOR = 1 << 0      # 0x00000001 - Full access, bypasses all checks
    
    # Member Management
    KICK_MEMBERS = 1 << 1       # 0x00000002
    BAN_MEMBERS = 1 << 2        # 0x00000004
    TIMEOUT_MEMBERS = 1 << 3   # 0x00000008
    
    # Message Management
    MANAGE_MESSAGES = 1 << 4    # 0x00000010 - Delete others' messages
    
    # Channel Management
    MANAGE_CHANNELS = 1 << 5    # 0x00000020
    
    # Role Management
    MANAGE_ROLES = 1 << 6       # 0x00000040
    
    # Server Management
    MANAGE_SERVER = 1 << 7      # 0x00000080
    
    # Voice
    MUTE_MEMBERS = 1 << 8       # 0x00000100 - Mute in voice
    DEAFEN_MEMBERS = 1 << 9     # 0x00000200 - Deafen in voice
    MOVE_MEMBERS = 1 << 10      # 0x00000400 - Move between voice channels
    
    # Basic
    SEND_MESSAGES = 1 << 11     # 0x00000800
    VIEW_CHANNELS = 1 << 12     # 0x00001000
    ATTACH_FILES = 1 << 13      # 0x00002000
    EMBED_LINKS = 1 << 14       # 0x00004000
    
    # Invites
    CREATE_INVITES = 1 << 15    # 0x00008000
    
    # View audit log
    VIEW_AUDIT_LOG = 1 << 16    # 0x00010000


# Default permission sets
DEFAULT_MEMBER_PERMISSIONS = (
    Permission.SEND_MESSAGES |
    Permission.VIEW_CHANNELS |
    Permission.ATTACH_FILES |
    Permission.EMBED_LINKS |
    Permission.CREATE_INVITES
)

MODERATOR_PERMISSIONS = (
    DEFAULT_MEMBER_PERMISSIONS |
    Permission.KICK_MEMBERS |
    Permission.TIMEOUT_MEMBERS |
    Permission.MANAGE_MESSAGES
)

ADMIN_PERMISSIONS = (
    MODERATOR_PERMISSIONS |
    Permission.BAN_MEMBERS |
    Permission.MANAGE_CHANNELS |
    Permission.MANAGE_ROLES |
    Permission.VIEW_AUDIT_LOG
)

OWNER_PERMISSIONS = Permission.ADMINISTRATOR  # Full access


def has_permission(user_permissions: int, required_permission: int) -> bool:
    """
    Check if user has a specific permission.
    
    Args:
        user_permissions: User's combined permission bitmask
        required_permission: The permission to check for
        
    Returns:
        True if user has the permission (or is admin)
    """
    # Administrators bypass all checks
    if user_permissions & Permission.ADMINISTRATOR:
        return True
    
    return (user_permissions & required_permission) == required_permission


def has_any_permission(user_permissions: int, *required_permissions: int) -> bool:
    """Check if user has ANY of the specified permissions."""
    if user_permissions & Permission.ADMINISTRATOR:
        return True
    
    for perm in required_permissions:
        if (user_permissions & perm) == perm:
            return True
    return False


def compute_permissions(role_permissions_list: list[int]) -> int:
    """
    Combine permissions from multiple roles.
    
    Args:
        role_permissions_list: List of permission bitmasks from user's roles
        
    Returns:
        Combined permission bitmask
    """
    combined = 0
    for perms in role_permissions_list:
        combined |= perms
    return combined


def permission_to_string(permission: int) -> list[str]:
    """Convert permission bitmask to list of permission names."""
    names = []
    perm_map = {
        Permission.ADMINISTRATOR: "ADMINISTRATOR",
        Permission.KICK_MEMBERS: "KICK_MEMBERS",
        Permission.BAN_MEMBERS: "BAN_MEMBERS",
        Permission.TIMEOUT_MEMBERS: "TIMEOUT_MEMBERS",
        Permission.MANAGE_MESSAGES: "MANAGE_MESSAGES",
        Permission.MANAGE_CHANNELS: "MANAGE_CHANNELS",
        Permission.MANAGE_ROLES: "MANAGE_ROLES",
        Permission.MANAGE_SERVER: "MANAGE_SERVER",
        Permission.MUTE_MEMBERS: "MUTE_MEMBERS",
        Permission.DEAFEN_MEMBERS: "DEAFEN_MEMBERS",
        Permission.MOVE_MEMBERS: "MOVE_MEMBERS",
        Permission.SEND_MESSAGES: "SEND_MESSAGES",
        Permission.VIEW_CHANNELS: "VIEW_CHANNELS",
        Permission.ATTACH_FILES: "ATTACH_FILES",
        Permission.EMBED_LINKS: "EMBED_LINKS",
        Permission.CREATE_INVITES: "CREATE_INVITES",
        Permission.VIEW_AUDIT_LOG: "VIEW_AUDIT_LOG",
    }
    
    for perm, name in perm_map.items():
        if permission & perm:
            names.append(name)
    
    return names
