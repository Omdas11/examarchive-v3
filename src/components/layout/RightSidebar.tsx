"use client";

import Link from "next/link";

interface RightSidebarProps {
  userName?: string;
  userInitials?: string;
}

export default function RightSidebar({ userName = "Guest", userInitials = "GU" }: RightSidebarProps) {
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Profile</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full gradient-primary text-on-primary font-bold flex items-center justify-center">
            {userInitials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{userName}</p>
            <p className="text-xs text-on-surface-variant">Scholar</p>
          </div>
        </div>
        <Link href="/profile" className="btn mt-4 w-full justify-center text-sm">
          Open Profile
        </Link>
      </div>

      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Quick Access</p>
        <div className="mt-3 space-y-2 text-sm">
          <Link href="/upload" className="block rounded-lg px-3 py-2 hover:bg-surface-container-low transition-colors">
            Upload Paper
          </Link>
          <Link href="/browse" className="block rounded-lg px-3 py-2 hover:bg-surface-container-low transition-colors">
            Browse Papers
          </Link>
          <Link href="/syllabus" className="block rounded-lg px-3 py-2 hover:bg-surface-container-low transition-colors">
            Syllabus
          </Link>
        </div>
      </div>
    </div>
  );
}
