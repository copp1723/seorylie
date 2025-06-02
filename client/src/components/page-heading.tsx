import React from "react";

interface PageHeadingProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

function PageHeading({
  title,
  description,
  children,
}: PageHeadingProps) {
  return (
    <div className="flex justify-between items-start mb-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">{title}</h1>
        {description && <p className="text-gray-600">{description}</p>}
      </div>
      {children && <div>{children}</div>}
    </div>
  );
}

// Export both as default and named export
export default PageHeading;
export { PageHeading };
