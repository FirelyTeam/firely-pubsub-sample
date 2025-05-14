from datetime import datetime, timezone
import glob
import json
import os
import uuid


def read_ndjson_files_from_directory(directory):
    ndjson_files = glob.glob(os.path.join(directory, "*.ndjson"))
    for file_path in ndjson_files:
        print(f"Processing file: {file_path}")
        with open(file_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    resource = json.loads(line)

                    resource_type = resource.get("resourceType", None)
                    if resource_type is None:
                        raise f"Skipping line without resourceType: {line}"

                    resource_id = resource.get("id", None)
                    if resource_id is None:
                        raise f"Skipping line without id: {line}"

                    resource["meta"] = resource.get("meta", {})

                    resource_version_id = resource.get("meta.version", None)
                    if resource_version_id is None:
                        resource["meta"]["versionId"] = resource_version_id = str(uuid.uuid4())
                        print(f"Resource version ID not found, generating new ID: {resource_version_id}")

                    last_updated = resource.get("meta.lastUpdated", None)
                    if last_updated is None:
                        resource["meta"]["lastUpdated"] = last_updated = datetime.now(timezone.utc).isoformat()
                        print(f"Last updated not found, generating new timestamp: {last_updated}")

                    yield (resource_type, resource_id, json.dumps(resource))
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON: {e}")
                except Exception as e:
                    print(f"Error processing line: {e}")