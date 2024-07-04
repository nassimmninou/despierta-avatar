import React from "react";
import Markdown from "markdown-to-jsx";
import cx from "@/utils/cx";
import UpstashLogo from "@/components/upstash-logo";

interface ResponseMessageProps {
  content: string;
  style?: React.CSSProperties; // Adding style prop
}

const ResponseMessage: React.FC<ResponseMessageProps> = ({ content, style }) => {
  return (
    <article
      className={cx(
        "mb-4 flex items-start gap-4 p-4 md:p-5 rounded-2xl",
        "bg-blue-50", // Different background color for response
      )}
      style={{
        ...style,
        maxHeight: '100%', // Set a maximum height
        overflowY: 'auto', // Enable vertical scrolling
      }} >
      <Markdown
        className={cx(
          "py-1.5 md:py-1 space-y-4",
        )}
        options={{
          overrides: {
            ol: ({ children }) => <ol className="list-decimal">{children}</ol>,
            ul: ({ children }) => <ul className="list-disc">{children}</ul>,
            a: {
              component: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
            },
            img: {
              component: ({ ...props }) => (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <img {...props} className="max-w-full h-auto" style={{ maxWidth: '70%' }} />
                </div>
              ),
            },
          },
          
        }}
      >
        {content}
      </Markdown>
      
    </article>
  );
};

const ResponseAvatar: React.FC<{ className?: string }> = ({
  className,
}) => {
  return (
    <div
      className={cx(
        "flex items-center justify-center size-8 shrink-0 rounded-full",
        "bg-blue-950", // Different color for response avatar
        className,
      )}
    >
      <UpstashLogo />
    </div>
  );
};

export default ResponseMessage;
export { ResponseAvatar };
