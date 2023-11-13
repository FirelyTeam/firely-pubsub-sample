// See https://aka.ms/new-console-template for more information

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using Firely.Server.Contracts.MassTransit;
using Firely.Server.Contracts.Messages.V1;
using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;
using Hl7.Fhir.Specification;
using MassTransit;
using ResourceReference = Firely.Server.Contracts.Messages.V1.ResourceReference;
using T = System.Threading.Tasks;

namespace Firely.Server.MessageSender;

public static class Program
{
    private static PubSubClient? _client;

    private static void PrintUsage()
    {
        Console.WriteLine("Valid commands are:");
        Console.WriteLine("\tQuit");
        Console.WriteLine("\t\tq ");
        Console.WriteLine("\tHelp");
        Console.WriteLine("\t\t? ");
        Console.WriteLine("\tCreate Patient");
        Console.WriteLine("\t\tc familyName patientId patientVersion");
        Console.WriteLine("\tRetrieve Patient");
        Console.WriteLine("\t\tr patientId patientVersion");
        Console.WriteLine("\tUpdate Patient");
        Console.WriteLine("\t\tu familyName patientId patientVersion");
        Console.WriteLine("\tDelete Patient");
        Console.WriteLine("\t\td patientId currentVersion");
    }
    
    static async T.Task Main()
    {
        var control = Bus.Factory.CreateUsingRabbitMq(cfg =>
        {
            cfg.UseJsonSerializer();
            cfg.ConfigureJsonSerializerOptions(o =>
            {
                o.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, false));
                return o;
            });
            cfg.ReceiveEndpoint("dotnet-test-client", e =>
            {
                e.Consumer(() => new ResourcesChangedConsumer());
                e.PrefetchCount = 64;
            });
        });
        
        _ = await control.StartAsync();
        Console.WriteLine("Bus was started");

        _client = new PubSubClient(control, FhirRelease.STU3);
        
        List<StorePlanItem> storePlanItems = new();
        List<RetrievePlanItem> retrievePlanItems = new();

        try
        {
            var stop = false;
            while (stop)
            {
                Console.WriteLine("Enter a command:");

                var input = (await Console.In.ReadLineAsync())!;

                var continued = input.EndsWith(";");
                var inputParts = input.TrimEnd(';').Split(' ');
                var command = inputParts[0];
                var arguments = inputParts.Skip(1);
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
                        if (BuildRetrievePlanItem(arguments) is { } retrievePlanItem)
                        {
                            retrievePlanItems.Add(retrievePlanItem);

                            if (!continued)
                            {
                                await RunRetrievePlan(retrievePlanItems);
                                retrievePlanItems.Clear();
                            }
                        }
                        else
                        {
                            Console.WriteLine("Invalid arguments.");
                            PrintUsage();
                        }
                        break;
                    case "d":
                    case "c":
                    case "u":
                    case "ups":
                        if (BuildStorePlanItem(command, arguments) is { } storePlanItem)
                        {
                            storePlanItems.Add(storePlanItem);
                            if (!continued)
                            {
                                await RunExecuteStorePlan(storePlanItems);
                                storePlanItems.Clear();
                            }
                        }
                        else
                        {
                            Console.WriteLine("Invalid arguments.");
                            PrintUsage();
                        }
                        continue;
                    default:
                        Console.WriteLine("Invalid command.");
                        PrintUsage();
                        break;
                }

            }
        }
        finally
        {
            await control.StopAsync();
        }
    }

    private static RetrievePlanItem BuildRetrievePlanItem(IEnumerable<string> args)
    {
        var (id, version) = get2(args);

        var reference = new ResourceReference("Patient", id!, version);
        return new RetrievePlanItem(MakeId(id!), reference);
    }
    
    private static async T.Task RunRetrievePlan(List<RetrievePlanItem> items)
    {
        try
        {
            var command = new RetrievePlanCommand(items);
            Console.WriteLine("Running retrieve plan " + command);
            var response = await _client!.RetrievePlan(command);
            Console.WriteLine(response.ToString());
        }
        catch (Exception e)
        {
            Console.WriteLine($"Error while executing retrieve plan: {e}");
        }
    }
    
    private static StorePlanItem? BuildStorePlanItem(string command, IEnumerable<string> args)
    {
        var storePlanItem = command switch
        {
            "d" => DeletePatient(args),
            "c" => CreatePatient(args),
            "u" => UpdatePatient(args, upsert: false),
            "ups" => UpdatePatient(args, upsert: true),
            _ => null
        };

        return storePlanItem;
    }

    private static T Get<T, V>(IEnumerable<V> args, Func<IEnumerable<V>, V?, T> f)
    {
        var list = args.ToList();
        var head = list.FirstOrDefault();
        var tail = list.Skip(1);
        return f(tail, head);
    }

    private static (string?, string?) get2(IEnumerable<string> args) =>
           Get(args, (t1, a1) =>
           Get(t1, (_, a2) =>
           (a1, a2)));

    private static (string?, string?, string?) get3(IEnumerable<string> args)
    {
        return Get(args, (t1, a1) =>
            Get(t1, (t2, a2) =>
                Get(t2, (_, a3) =>
                    (a1, a2, a3))));
    }

    private static string MakeId(string id) => $"Patient/{id}";

    private static StorePlanItem CreatePatient(IEnumerable<string> args)
    {
        var (family, id, vid) = get3(args);

        var p = new Patient { 
            Id = id, 
            Meta = new() { VersionId = vid, LastUpdated = DateTimeOffset.Now},
            Name = { new HumanName { Family = family }}
        };

        return new StorePlanItem(MakeId(id!), p.ToJson(), p.TypeName, p.Id, p.VersionId, StorePlanItemOperation.Create);
    }
    
    private static StorePlanItem UpdatePatient(IEnumerable<string> args, bool upsert)
    {
        var (family, id, vid) = get3(args);

        var p = new Patient { 
            Id = id, 
            Meta = new() { VersionId = vid, LastUpdated = DateTimeOffset.Now},
            Name = { new HumanName { Family = family }}
        };

        return new StorePlanItem(MakeId(id!), p.ToJson(), p.TypeName, p.Id, vid,
            upsert ? StorePlanItemOperation.Upsert : StorePlanItemOperation.Update);
    }
    
    private static StorePlanItem DeletePatient(IEnumerable<string> args)
    {
        var (id, currentVersion) = get2(args);

        return new StorePlanItem(MakeId(id!), null, "Patient", id, currentVersion, StorePlanItemOperation.Delete);
    }
    
    private static async T.Task RunExecuteStorePlan(List<StorePlanItem> storePlanItems)
    {
        try
        {
            var command = new ExecuteStorePlanCommand(storePlanItems);
            Console.WriteLine("Running plan " + command);
            var response = await _client!.ExecuteStorePlan(command);
            
            Console.WriteLine(response.ToString());
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
        }
    }
}

internal class ResourcesChangedConsumer :  IConsumer<ResourcesChangedLightEvent>
{
    public T.Task Consume(ConsumeContext<ResourcesChangedLightEvent> context)
    {
        if (context.Message is { } changes)
        {
            Console.WriteLine($"Received changed event: {changes}.");
        }

        return T.Task.CompletedTask;
    }
}
