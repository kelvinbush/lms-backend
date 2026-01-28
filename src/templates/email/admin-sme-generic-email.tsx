import { Section } from "@react-email/components";
import type * as React from "react";
import { BaseTemplate } from "./base-template";

interface AdminSMEGenericEmailProps {
  subject: string;
  bodyHtml: string;
  firstName?: string | null;
}

export const AdminSMEGenericEmail = ({
  subject,
  bodyHtml,
  firstName,
}: AdminSMEGenericEmailProps) => {
  return (
    <BaseTemplate previewText={subject} title={subject} firstName={firstName || ""}>
      {/* Inject WYSIWYG HTML as-is while keeping the global layout */}
      {/* eslint-disable-next-line react/no-danger */}
      <Section dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </BaseTemplate>
  );
};

export default AdminSMEGenericEmail;

