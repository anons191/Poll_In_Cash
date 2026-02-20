"use client";

/**
 * Navbar Component
 * Responsive nav with logo, links, mobile menu, connect wallet button
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "../ui/Button";

// ============ Types ============

interface NavLink {
  href: string;
  label: string;
  active?: boolean;
}

interface NavbarProps {
  /** Navigation links */
  links?: NavLink[];
  /** Current path for active state */
  currentPath?: string;
  /** Wallet connect component slot */
  walletButton?: React.ReactNode;
  /** Logo click handler */
  onLogoClick?: () => void;
  /** Additional className */
  className?: string;
}

// ============ Default Links ============

const defaultLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/polls", label: "Polls" },
  { href: "/create", label: "Create Poll" },
  { href: "/profile", label: "Profile" },
];

// ============ Component ============

export function Navbar({
  links = defaultLinks,
  currentPath = "",
  walletButton,
  onLogoClick,
  className = "",
}: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={`bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              onClick={onLogoClick}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1B4D7A] to-[#14B8A6] flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                Poll in Cash
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const isActive = currentPath === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "text-[#1B4D7A] dark:text-[#14B8A6] bg-[#1B4D7A]/10 dark:bg-[#14B8A6]/10"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right side - wallet button */}
          <div className="hidden md:flex items-center gap-4">
            {walletButton || (
              <Button variant="primary" size="sm">
                Connect Wallet
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={toggleMobileMenu}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800">
          <div className="px-4 py-4 space-y-2">
            {links.map((link) => {
              const isActive = currentPath === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className={`block px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "text-[#1B4D7A] dark:text-[#14B8A6] bg-[#1B4D7A]/10 dark:bg-[#14B8A6]/10"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              {walletButton || (
                <Button variant="primary" fullWidth>
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
