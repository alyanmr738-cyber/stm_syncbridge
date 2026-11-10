import { AdminShell, Panel, SettingsSubnav } from "@/components/admin/shell";
import { loadFieldMappingSpec } from "@/lib/data/field-mapping";

export default function MappingsPage() {
  const rows = loadFieldMappingSpec();
  return (
    <AdminShell title="Field mapping" subtitle="Source-of-truth matrix from the integration spec.">
      <SettingsSubnav />
      <Panel>
        <p className="mb-4 text-sm text-[#657683]">
          Spec from package worksheet. Service-to-Jobber catalog mappings are
          managed separately; unmapped GHL intents stay in review.
        </p>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#e1e8ec] text-[#657683]">
                <th className="py-2 pr-2">Entity</th>
                <th className="py-2 pr-2">Field</th>
                <th className="py-2 pr-2">Authority</th>
                <th className="py-2">Policy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.entity}-${r.field}`} className="border-b border-[#eef1f3]">
                  <td className="py-2 pr-2">{r.entity}</td>
                  <td className="py-2 pr-2">{r.field}</td>
                  <td className="py-2 pr-2">{r.authoritativeSource}</td>
                  <td className="py-2">{r.policy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AdminShell>
  );
}
