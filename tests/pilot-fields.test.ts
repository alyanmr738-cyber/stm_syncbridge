import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { canWriteToProviders } from "@/lib/config/feature-flags";
import {
  buildPilotGhlContactBody,
  existingRecordsOnly,
  getPilotGhlAllowedFields,
  pilotAllows,
} from "@/lib/config/pilot";
import { STM_GHL } from "@/lib/config/stm-mapping";

describe("restricted pilot field allowlist", () => {
  const prev = { ...process.env };
  beforeEach(() => {
    process.env = {
      ...prev,
      SYNC_ENABLED: "false",
      OUTBOUND_WRITES_ENABLED: "false",
      PILOT_JOBBER_CLIENT_IDS: "Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==",
      PILOT_GHL_CONTACT_IDS: "6fphEggI2IDws4TlmD6Q",
      PILOT_GHL_ALLOWED_FIELDS: "jobberClientId",
    };
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
  });

  it("keeps Gate A off", () => {
    expect(canWriteToProviders()).toBe(false);
    expect(existingRecordsOnly()).toBe(true);
  });

  it("payload is Jobber Client ID custom field only", () => {
    expect([...getPilotGhlAllowedFields()]).toEqual(["jobberClientId"]);
    const body = buildPilotGhlContactBody({
      firstName: "ALEX",
      lastName: "TETIYEVKI",
      email: "alext@usa.net",
      phone: "+12012590233",
      address1: "3439 N SALFORD BLVD",
      city: "NORTH PORT",
      postalCode: "34286",
      jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==",
    });
    expect(body).toEqual({
      customFields: [
        {
          id: STM_GHL.fields.jobberClientId,
          field_value: "Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==",
        },
      ],
    });
    expect(body).not.toHaveProperty("firstName");
    expect(body).not.toHaveProperty("phone");
    expect(body).not.toHaveProperty("email");
  });

  it("repeat payload is identical (idempotent)", () => {
    const input = { jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==" };
    expect(buildPilotGhlContactBody(input)).toEqual(buildPilotGhlContactBody(input));
  });

  it("blocks unrelated records and all creates", () => {
    expect(
      pilotAllows({
        jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==",
        ghlContactId: "6fphEggI2IDws4TlmD6Q",
      })
    ).toBe(true);
    expect(
      pilotAllows({
        jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==",
        ghlContactId: "someone-else",
      })
    ).toBe(false);
    expect(
      pilotAllows({
        jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==",
        creatingGhlContact: true,
      })
    ).toBe(false);
    expect(
      pilotAllows({
        jobberJobId: "any-job",
        creatingGhlOpportunity: true,
      })
    ).toBe(false);
  });
});
