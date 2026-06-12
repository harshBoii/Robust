import type {
  AudienceDna,
  CommunicationDna,
  ComplianceDna,
} from "@/app/generated/prisma/client";
import {
  serializeAudienceDna,
  serializeCommunicationDna,
  serializeComplianceDna,
} from "@/lib/brand-dna/serialize";
import type {
  AudienceDnaDto,
  CommunicationDnaDto,
  ComplianceDnaDto,
} from "@/lib/brand-dna/types";

export type AeoPageCommunicationDna = Omit<
  CommunicationDnaDto,
  "id" | "brandEntityId"
>;
export type AeoPageAudienceDna = Omit<AudienceDnaDto, "id" | "brandEntityId">;
export type AeoPageComplianceDna = Omit<ComplianceDnaDto, "id" | "brandEntityId">;

export type AeoPageDnaPayload = {
  communicationDna?: AeoPageCommunicationDna;
  audienceDna?: AeoPageAudienceDna;
  complianceDna?: AeoPageComplianceDna;
};

function stripDnaMetadata<T extends Record<string, unknown>>(row: T | null) {
  if (!row) return undefined;
  const { id: _id, brandEntityId: _brandEntityId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } =
    row;
  return rest;
}

export function buildAeoPageDnaPayload(brand: {
  communicationDna: CommunicationDna | null;
  audienceDna: AudienceDna | null;
  complianceDna: ComplianceDna | null;
}): AeoPageDnaPayload {
  const communicationDna = stripDnaMetadata(
    serializeCommunicationDna(brand.communicationDna),
  ) as AeoPageCommunicationDna | undefined;
  const audienceDna = stripDnaMetadata(
    serializeAudienceDna(brand.audienceDna),
  ) as AeoPageAudienceDna | undefined;
  const complianceDna = stripDnaMetadata(
    serializeComplianceDna(brand.complianceDna),
  ) as AeoPageComplianceDna | undefined;

  return {
    ...(communicationDna ? { communicationDna } : {}),
    ...(audienceDna ? { audienceDna } : {}),
    ...(complianceDna ? { complianceDna } : {}),
  };
}
