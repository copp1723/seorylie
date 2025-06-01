import React from "react";

interface PageHeadingProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

const PageHeading = React.memo(({
  title,
  description,
  children,
}: PageHeadingProps) => {
  return (
    <div className="flex justify-between items-start mb-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">{title}</h1>
        {description && <p className="text-gray-600">{description}</p>}
      </div>
      {children && <div>{children}</div>}
    </div>
  );
});

PageHeading.displayName = "PageHeading";

export default PageHeading;
