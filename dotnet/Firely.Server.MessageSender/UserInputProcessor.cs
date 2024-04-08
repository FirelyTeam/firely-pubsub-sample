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
    private readonly ImportOptions _importOptions;
    private readonly PubSubClient _pubSubClient;
    
    public UserInputProcessor(PubSubClient pubSubClient, IOptions<ImportOptions> importOptions)
    {
        _pubSubClient = pubSubClient;
        _importOptions = importOptions.Value;
    }
    
    public async Task ProcessUserInput()
    {
        List<StorePlanItem> storePlanItems = new();
        List<RetrievePlanItem> retrievePlanItems = new();

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
                    await RunExecuteStorePlanNoWait(storePlanItems);
                    storePlanItems.Clear();
                }
            }
        }
    }

    public async Task ImportResourcesFromDirectory()
    {
        var directoryPath = _importOptions.ImportDirectory;
        if (string.IsNullOrEmpty(directoryPath))
        {
            Console.WriteLine("No directory specified in appsettings ImportOptions.");
            return;
        }
        if (CommandProcessor.BuildStorePlanItems("import", new[] {directoryPath}) is { } storePlanItems)
        {
            await RunExecuteStorePlan(storePlanItems);
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
            Console.WriteLine($"Response from {nameof(RetrievePlanCommand)}: '{JsonSerializer.Serialize(response)}'");
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
            Console.WriteLine($"Response from {nameof(ExecuteStorePlanCommand)}: '{JsonSerializer.Serialize(response)}'");
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
        }
    }

    private async Task RunExecuteStorePlanNoWait(List<StorePlanItem> storePlanItems)
    {
        try
        {
            var command = new ExecuteStorePlanCommand(storePlanItems);
            Console.WriteLine($"Sending {nameof(ExecuteStorePlanCommand)} for {storePlanItems.Count} items: '{JsonSerializer.Serialize(command)}'");

            // Allow multiple commands to be sent without awaiting ("fire-and-forget")
            _ = _pubSubClient.ExecuteStorePlan(command).ContinueWith(task =>
            {
                var response = task;
                if (task.IsFaulted)
                {
                    Console.WriteLine($"Error while executing store plan: {task.Exception}");
                    return;
                }
                Console.WriteLine($"Response from {nameof(ExecuteStorePlanCommand)}: '{JsonSerializer.Serialize(response)}'");
            });
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
    }
    
}