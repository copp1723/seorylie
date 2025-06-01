import React from "react";

interface PageHeadingProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode; // Deprecated: use children instead
}

const PageHeading = React.memo(({
  title,
  description,
  children,
  actions, // Deprecated: use children instead
}: PageHeadingProps) => {
  // Support both children and actions props for backward compatibility
  const rightContent = children || actions;
  
  return (
    <div className="flex justify-between items-start mb-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">{title}</h1>
        {description && <p className="text-gray-600">{description}</p>}
      </div>
      {rightContent && <div>{rightContent}</div>}
    </div>
  );
});

PageHeading.displayName = "PageHeading";

export default PageHeading;
