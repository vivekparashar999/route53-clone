"use client";

import AttributeEditor from "@cloudscape-design/components/attribute-editor";
import Input from "@cloudscape-design/components/input";
import type { Tag } from "@/lib/types";

/** Key/value tag editor used on the create/edit hosted zone forms. */
export default function ZoneTagsEditor({ tags, onChange }: { tags: Tag[]; onChange: (t: Tag[]) => void }) {
  const set = (index: number, patch: Partial<Tag>) => onChange(tags.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <AttributeEditor
      items={tags}
      addButtonText="Add tag"
      removeButtonText="Remove tag"
      onAddButtonClick={() => onChange([...tags, { key: "", value: "" }])}
      onRemoveButtonClick={({ detail }) => onChange(tags.filter((_, i) => i !== detail.itemIndex))}
      empty="No tags associated with the resource."
      additionalInfo={`You can add ${50 - tags.length} more tags.`}
      disableAddButton={tags.length >= 50}
      definition={[
        {
          label: "Key",
          control: (t, i) => <Input value={t.key} placeholder="Enter key" onChange={({ detail }) => set(i, { key: detail.value })} />,
          errorText: (t) => (t.key.length > 128 ? "Key must be 128 characters or fewer." : null),
        },
        {
          label: "Value - optional",
          control: (t, i) => (
            <Input value={t.value} placeholder="Enter value" onChange={({ detail }) => set(i, { value: detail.value })} />
          ),
          errorText: (t) => (t.value.length > 256 ? "Value must be 256 characters or fewer." : null),
        },
      ]}
    />
  );
}
