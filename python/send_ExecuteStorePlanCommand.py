import os
import json
from azure.servicebus import ServiceBusClient, ServiceBusMessage
from dotenv import load_dotenv

from utils import read_ndjson_files_from_directory

# Load environment variables from .env file
load_dotenv()

NDJSON_INPUT_DIRECTORY = os.getenv("NDJSON_INPUT_DIRECTORY", "/ndjson_files")
SERVICE_BUS_CONNECTION_STR = os.getenv("SERVICE_BUS_CONNECTION_STR")
FHIR_RELEASE = os.getenv("FHIR_RELEASE", "R4")


def process_ndjson_files(directory):
    servicebus_client = ServiceBusClient.from_connection_string(conn_str=SERVICE_BUS_CONNECTION_STR, logging_enable=True)

    with servicebus_client:
        # Create a sender for the topic
        sender = servicebus_client.get_topic_sender(topic_name="firely.server.contracts.messages.v1/executestoreplancommand")

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

                    # Wrap it into a MassTransit envelope
                    envelope = {
                        "messageType": [
                            "urn:message:Firely.Server.Contracts.Messages.V1:ExecuteStorePlanCommand"
                        ],
                        "headers": {
                            "fhir-release": FHIR_RELEASE
                        },
                        "message": payload
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