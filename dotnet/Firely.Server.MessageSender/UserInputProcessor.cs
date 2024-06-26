using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Firely.Server.Contracts.MassTransit;
using Firely.Server.Contracts.Messages.V1;
using Microsoft.Extensions.Options;

namespace Firely.Server.MessageSender;

public class UserInputProcessor
{
    private readonly PubSubClient _pubSubClient;
    
    public UserInputProcessor(PubSubClient pubSubClient)
    {
        _pubSubClient = pubSubClient;
    }
    
    public async Task ProcessUserInput(string[] args)
    {
        // Import mode
        if (args.FirstOrDefault() == "import")
        {
            var directoryPath = args.ElementAtOrDefault(1);
            if (string.IsNullOrEmpty(directoryPath))
            {
                Console.WriteLine("No directory specified as first argument. Exiting...");
                return;
            }
            await ImportResourcesFromDirectory(directoryPath);
            return;
        }

        List<StorePlanItem> storePlanItems = new();
        List<RetrievePlanItem> retrievePlanItems = new();

        // Interactive mode
        var stop = false;
        while (!stop)
        {
            Console.WriteLine("Enter a command:");

            var input = (await Console.In.ReadLineAsync())!;

            var continued = input.EndsWith(";");
            var inputParts = input.TrimEnd(';').Split(' ');
            var command = inputParts[0];
            var arguments = inputParts.Skip(1);
            var badArguments = false;
            switch (command)
            {
                case "q":
                    Console.WriteLine("Exiting...");
                    stop = true;
                    break;
                case "?":
                    PrintUsage();
                    break;
                case "r":
                    if (CommandProcessor.BuildRetrievePlanItem(arguments) is { } retrievePlanItem)
                    {
                        retrievePlanItems.Add(retrievePlanItem);
                        break;
                    }
                    badArguments = true;
                    break;
                case "d":
                case "c":
                case "u":
                case "ups":
                    if (CommandProcessor.BuildStorePlanItem(command, arguments) is { } storePlanItem)
                    {
                        storePlanItems.Add(storePlanItem);
                        break;
                    }
                    badArguments = true;
                    break;
                default:
                    Console.WriteLine("Invalid command.");
                    PrintUsage();
                    break;
            }

            if (badArguments)
            {
                Console.WriteLine("Invalid arguments.");
                PrintUsage();
            }

            if (!continued)
            {
                if (retrievePlanItems.Any())
                {
                    await RunRetrievePlan(retrievePlanItems);
                    retrievePlanItems.Clear();
                }
                if (storePlanItems.Any())
                {
                    await RunExecuteStorePlan(storePlanItems);
                    storePlanItems.Clear();
                }
            }
        }
    }

    public async Task ImportResourcesFromDirectory(string directoryPath)
    {
        if (CommandProcessor.BuildStorePlanItems("import", new[]{ directoryPath }) is { } importStorePlanItems)
        {
            await RunExecuteStorePlan(importStorePlanItems);
            // Optionally move successfully imported files to an archive folder
        }
    }

    private async Task RunRetrievePlan(List<RetrievePlanItem> items)
    {
        try
        {
            var command = new RetrievePlanCommand(items);
            Console.WriteLine($"Sending {nameof(RetrievePlanCommand)}: '{JsonSerializer.Serialize(command)}'");
            var response = await _pubSubClient.RetrievePlan(command);
            Console.WriteLine($"\nResponse from {nameof(RetrievePlanCommand)}: '{JsonSerializer.Serialize(response)}'\n");
        }
        catch (Exception e)
        {
            Console.WriteLine($"Error while executing retrieve plan: {e}");
        }
    }
    
    private async Task RunExecuteStorePlan(List<StorePlanItem> storePlanItems)
    {
        try
        {
            var command = new ExecuteStorePlanCommand(storePlanItems);
            Console.WriteLine($"Sending {nameof(ExecuteStorePlanCommand)}: '{JsonSerializer.Serialize(command)}'");
            var response = await _pubSubClient.ExecuteStorePlan(command);
            Console.WriteLine($"\nResponse from {nameof(ExecuteStorePlanCommand)}: '{JsonSerializer.Serialize(response)}'\n");
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
        }
    }

    private static void PrintUsage()
    {
        Console.WriteLine("Valid interactive commands are:");
        Console.WriteLine("\tQuit");
        Console.WriteLine("\t\tq ");
        Console.WriteLine("\tHelp");
        Console.WriteLine("\t\t? ");
        Console.WriteLine("\tCreate Patient");
        Console.WriteLine("\t\tc familyName patientId patientVersion");
        Console.WriteLine("\tRetrieve Patient");
        Console.WriteLine("\t\tr patientId patientVersion");
        Console.WriteLine("\tUpdate Patient");
        Console.WriteLine("\t\tu familyName patientId newPatientVersion currentPatientVersion");
        Console.WriteLine("\tDelete Patient");
        Console.WriteLine("\t\td patientId currentPatientVersion");
        Console.WriteLine("To import from a directory, re-run with 'import <directoryPath>' appended to the command line.");
    }
    
}