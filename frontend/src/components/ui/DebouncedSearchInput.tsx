import React, { useState, useEffect } from "react";
import { Input } from "antd";
import type { InputProps } from "antd";
import { SearchOutlined } from "@ant-design/icons";

interface DebouncedSearchInputProps extends Omit<InputProps, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  debounceTimeout?: number;
}

const DebouncedSearchInput: React.FC<DebouncedSearchInputProps> = ({
  value,
  onChange,
  debounceTimeout = 500,
  ...props
}) => {
  const [draft, setDraft] = useState({ sourceValue: value, value });
  const localValue = draft.sourceValue === value ? draft.value : value;

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceTimeout);

    return () => {
      clearTimeout(handler);
    };
  }, [localValue, onChange, value, debounceTimeout]);

  return (
    <Input
      prefix={<SearchOutlined className="text-gray-400 mr-1 text-sm" />}
      allowClear
      {...props}
      value={localValue}
      onChange={(e) => setDraft({ sourceValue: value, value: e.target.value })}
      className="h-9 rounded-md bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 hover:border-gray-400 focus:border-primary text-xs font-medium text-gray-900 dark:text-gray-100 transition-all placeholder:text-gray-400 shadow-sm"
    />
  );
};

export default DebouncedSearchInput;
