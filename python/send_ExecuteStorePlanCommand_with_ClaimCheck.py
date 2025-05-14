import os
import json
import uuid
from azure.servicebus import ServiceBusClient, ServiceBusMessage
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv

from utils import read_ndjson_files_from_directory

# Load environment variables from .env file
load_dotenv()

NDJSON_INPUT_DIRECTORY = os.getenv("NDJSON_INPUT_DIRECTORY", "/ndjson_files")
SERVICE_BUS_CONNECTION_STR = os.getenv("SERVICE_BUS_CONNECTION_STR")
BLOB_STORAGE_CONNECTION_STR = os.getenv("BLOB_STORAGE_CONNECTION_STR")
BLOB_STORAGE_CONTAINER_NAME = os.getenv("BLOB_STORAGE_CONTAINER_NAME")
FHIR_RELEASE = os.getenv("FHIR_RELEASE", "R4")

def upload_payload_to_blob_storage(container_client, resource):
    try:
        blob_name = str(uuid.uuid4()) + ".json"
        blob_client = container_client.get_blob_client(blob_name)

        resource_data = json.dumps(resource)
        blob_client.upload_blob(resource_data, overwrite=True)

        print(f"Uploaded resource to Blob Storage: {blob_client.url}")
        return blob_client.url
    except Exception as e:
        print(f"Error uploading resource to Blob Storage: {e}")
        raise


def process_ndjson_files(directory):
    servicebus_client = ServiceBusClient.from_connection_string(conn_str=SERVICE_BUS_CONNECTION_STR, logging_enable=True)

    blob_service_client = BlobServiceClient.from_connection_string(BLOB_STORAGE_CONNECTION_STR)
    blob_container_client = blob_service_client.get_container_client(BLOB_STORAGE_CONTAINER_NAME)


    with blob_service_client, blob_container_client, servicebus_client:

        # Check if the container exists, if not create it
        try:
            blob_container_client.get_container_properties()
            print(f"Container '{BLOB_STORAGE_CONTAINER_NAME}' exists.")
        except Exception as e:
            print(f"Container '{BLOB_STORAGE_CONTAINER_NAME}' does not exist. Attempting to create it.")
            blob_service_client.create_container(BLOB_STORAGE_CONTAINER_NAME)
            print(f"Container '{BLOB_STORAGE_CONTAINER_NAME}' created successfully.")

        # Create a sender for the topic
        sender = servicebus_client.get_topic_sender(topic_name="firely.server.contracts.messages.v1/claimcheckmessagewrapper--executestoreplancommand--")

        with sender:
            for (resource_type, resource_id, resource_json) in read_ndjson_files_from_directory(directory):
                try:
                    # Prepare the ExecuteStorePlanCommand message
                    payload = {
                        "instructions": [
                            {
                                "itemId": f"{resource_type}/{resource_id}",
                                "resourceType": resource_type,
                                "resourceId": resource_id,
                                "resource": resource_json,
                                "operation": "Upsert"
                            }
                        ]
                    }

                    # Create a lightweight wrapper with the ref to the original payload
                    claim_check_payload = {
                        "payload": {
                            "data-ref": upload_payload_to_blob_storage(blob_container_client, payload)
                        }
                    }

                    # Wrap it into a MassTransit envelope
                    envelope = {
                        "messageType": [
                            "urn:message:Firely.Server.Contracts.Messages.V1:ClaimCheckMessageWrapper[[Firely.Server.Contracts.Messages.V1:ExecuteStorePlanCommand]]"
                        ],
                        "headers": {
                            "fhir-release": FHIR_RELEASE
                        },
                        "message": claim_check_payload
                    }

                    # Send the message to Service Bus
                    message = ServiceBusMessage(json.dumps(envelope))
                    sender.send_messages(message)
                    print(f"Sent enveloped resource to Service Bus: {resource_type}/{resource_id}")
                except Exception as e:
                    print(f"Error processing line: {e}")

def main():
    process_ndjson_files(NDJSON_INPUT_DIRECTORY)

if __name__ == "__main__":
    main()