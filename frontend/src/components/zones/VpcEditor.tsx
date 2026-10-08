"use client";

import AttributeEditor from "@cloudscape-design/components/attribute-editor";
import Select from "@cloudscape-design/components/select";
import { AWS_REGIONS } from "@/lib/records";
import type { Vpc } from "@/lib/types";

/** Mocked VPCs per region - there is no real EC2 behind this clone. */
function vpcOptions(region: string) {
  const seed = region.split("-").map((p) => p.charCodeAt(0).toString(16)).join("");
  return ["default", "prod", "staging"].map((label, i) => {
    const id = `vpc-0${seed}${i}a1b2c3d4`.slice(0, 21);
    return { value: id, label: id, description: `${label}-vpc` };
  });
}

interface Props {
  vpcs: Vpc[];
  onChange: (v: Vpc[]) => void;
  /** Only flag missing VPCs after the user tried to submit. */
  showErrors?: boolean;
}

export default function VpcEditor({ vpcs, onChange, showErrors = false }: Props) {
  const set = (index: number, patch: Partial<Vpc>) => onChange(vpcs.map((v, i) => (i === index ? { ...v, ...patch } : v)));

  return (
    <AttributeEditor
      items={vpcs}
      addButtonText="Add VPC"
      removeButtonText="Remove VPC"
      onAddButtonClick={() => onChange([...vpcs, { region: "us-east-1", vpc_id: "" }])}
      onRemoveButtonClick={({ detail }) => onChange(vpcs.filter((_, i) => i !== detail.itemIndex))}
      isItemRemovable={() => vpcs.length > 1}
      definition={[
        {
          label: "Region",
          control: (v, i) => (
            <Select
              selectedOption={AWS_REGIONS.find((r) => r.value === v.region) ?? null}
              options={AWS_REGIONS}
              placeholder="Choose Region"
              onChange={({ detail }) => set(i, { region: detail.selectedOption.value!, vpc_id: "" })}
            />
          ),
        },
        {
          label: "VPC ID",
          control: (v, i) => {
            const options = vpcOptions(v.region);
            return (
              <Select
                selectedOption={options.find((o) => o.value === v.vpc_id) ?? null}
                options={options}
                placeholder="Choose VPC"
                onChange={({ detail }) => set(i, { vpc_id: detail.selectedOption.value! })}
              />
            );
          },
          errorText: (v) => (showErrors && !v.vpc_id ? "Choose a VPC." : null),
        },
      ]}
    />
  );
}
