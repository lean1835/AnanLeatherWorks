import React from "react";

interface FilterCardProps {
  children: React.ReactNode;
  className?: string;
}

const FilterCard: React.FC<FilterCardProps> = ({ children, className = "" }) => (
  <div
    className={`mb-4 rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-surface-dark p-2.5 sm:p-3 shadow-sm ${className}`}
  >
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 w-full">
      {children}
    </div>
  </div>
);

export default FilterCard;
