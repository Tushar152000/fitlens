/**
 * Staff roles for the FITR8 admin (/admin). One role per person across every admin section; each
 * section maps it to its own permissions (the blog: `blogCan` in ./blog.ts).
 */
export const STAFF_ROLES = ["ADMIN", "EDITOR", "AUTHOR"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  AUTHOR: "Author",
};

export type StaffAction =
  /** Invite people, change roles, remove them. */
  "manage-team";

export function staffCan(role: StaffRole, action: StaffAction): boolean {
  switch (action) {
    case "manage-team":
      return role === "ADMIN";
  }
}

/** Highest role first: comparing for "at least". */
export const roleRank = (role: StaffRole) => STAFF_ROLES.length - STAFF_ROLES.indexOf(role);
