using System;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using Firely.Server.Contracts.MassTransit;
using Firely.Server.Contracts.Messages.V1;
using Hl7.Fhir.Specification;
using Microsoft.Extensions.Hosting;
using MassTransit;
using MassTransit.Logging;
using Microsoft.Extensions.DependencyInjection;
using T = System.Threading.Tasks;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Microsoft.Extensions.Configuration;

namespace Firely.Server.MessageSender;

public static class Program
{
    public static async T.Task Main(string[] args)
    {
        var host = Host.CreateDefaultBuilder(args)
            .UseContentRoot(AppContext.BaseDirectory)
            .ConfigureAppConfiguration((hostingContext, config) =>
            {
                config.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true);
            })
            .ConfigureServices((context, services) =>
            {   
                // CLI
                services.AddTransient<UserInputProcessor>();
                
                // PubSub Client
                Type executeStorePlanCommandType = typeof(ExecuteStorePlanCommand);
                var executeStorePlanMessageName = $"{executeStorePlanCommandType.Namespace}:{executeStorePlanCommandType.Name}";
                Type retrievePlanCommandType = typeof(RetrievePlanCommand);
                var retrievePlanMessageName = $"{retrievePlanCommandType.Namespace}:{retrievePlanCommandType.Name}";
                Console.WriteLine(
                    $"Registering {nameof(PubSubClient)} class for sending {executeStorePlanMessageName} and {retrievePlanMessageName} messages and getting corresponding response.");
                services.AddTransient<PubSubClient>(sp => new PubSubClient(sp.GetRequiredService<IBus>(), FhirRelease.R4));

                var config = context.Configuration.GetRequiredSection("PubSub");
                var messageBrokerOptions = config.GetRequiredSection("MessageBroker");
                var messageBrokerHost = messageBrokerOptions.GetRequiredSection("Host").Value;
                var messageBrokerUser = messageBrokerOptions.GetRequiredSection("Username").Value;
                var messageBrokerPassword = messageBrokerOptions.GetRequiredSection("Password").Value;

                var openTelemetryEndpoint = new Uri("http://localhost:4317");

                services
                    .AddOpenTelemetry()
                    .ConfigureResource(r =>
                    {
                        var runningAssembly = Assembly.GetExecutingAssembly().GetName();
                        r.AddService(runningAssembly.FullName,
                            serviceVersion: runningAssembly.Version?.ToString(),
                            serviceInstanceId: Environment.MachineName);
                    })
                    .WithTracing(b => b
                        .AddSource(DiagnosticHeaders.DefaultListenerName) // MassTransit ActivitySource
                        // Uncomment to get trace from masstransit in the console
                        // .AddConsoleExporter() 
                        .AddOtlpExporter(o => { o.Endpoint = openTelemetryEndpoint; })
                    );

                // RabbitMQ listener
                services.AddMassTransit(configurator =>
                {
                    // This creates and connects to exchanges
                    configurator.AddConsumer<ResourcesChangedConsumer>();
                    configurator.AddConsumer<ResourcesChangedLightConsumer>();

                    configurator
                        .UsingRabbitMq((context, cfg) =>
                        {
                            cfg.Host(messageBrokerHost, h =>
                            {
                                h.Username(messageBrokerUser);
                                h.Password(messageBrokerPassword);
                            });
                            
                            cfg.UseJsonSerializer();
                            cfg.ConfigureJsonSerializerOptions(o =>
                            {
                                o.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, false));
                                return o;
                            });

                            // This creates queues and connects them to exchanges

                            // Listen for changed resources
                            Type resourcesChangedType = typeof(ResourcesChangedEvent);
                            var resourcesChangedMessageName = $"{resourcesChangedType.Namespace}:{resourcesChangedType.Name}";
                            var resourceChangedQueue = $"{resourcesChangedMessageName}_dotnet";
                            Console.WriteLine($"Setting up a queue and an exchange {resourceChangedQueue} to get {resourcesChangedMessageName} events");
                            cfg.ReceiveEndpoint(resourceChangedQueue, e => { e.ConfigureConsumer<ResourcesChangedConsumer>(context); });

                            // "Light" version won't contain full resource in body
                            Type resourcesChangedLightType = typeof(ResourcesChangedLightEvent);
                            var resourcesChangedLightMessageName = $"{resourcesChangedLightType.Namespace}:{resourcesChangedLightType.Name}";
                            var resourceChangedLightQueue = $"{resourcesChangedLightMessageName}_dotnet";
                            Console.WriteLine($"Setting up a queue and exchange {resourceChangedLightQueue} to get {resourcesChangedLightMessageName} events");
                            cfg.ReceiveEndpoint(resourceChangedLightQueue, e => { e.ConfigureConsumer<ResourcesChangedLightConsumer>(context); });
                        });
                });
            })
            .Build();


        var userInputProcessor = host.Services.GetRequiredService<UserInputProcessor>();

        await T.Task.WhenAny(host.RunAsync(), userInputProcessor.ProcessUserInput(args));
    }
}