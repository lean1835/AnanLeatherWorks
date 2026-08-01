import React from "react";
import { Tooltip } from "antd";
import { usePermission } from "../../hooks/usePermission";

interface AccessControlProps {
  permission: string;
  children: React.ReactElement<{
    className?: string;
    disabled?: boolean;
    onClick?: React.MouseEventHandler;
  }>;
}

const AccessControl: React.FC<AccessControlProps> = ({ permission, children }) => {
  const { hasPermission } = usePermission();
  const allowed = hasPermission(permission);

  if (!allowed) {
    return (
      <Tooltip title="Bạn không có quyền thực hiện hành động này">
        <span className="opacity-60 cursor-not-allowed">
          {React.cloneElement(children, {
            disabled: true,
            onClick: (e: React.MouseEvent) => e.preventDefault(),
            className: `${children.props?.className || ""} pointer-events-none`,
          })}
        </span>
      </Tooltip>
    );
  }

  return children;
};

export default AccessControl;
