using System;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using Firely.Server.Contracts.MassTransit;
using Hl7.Fhir.Specification;
using Microsoft.Extensions.Hosting;
using MassTransit;
using MassTransit.Logging;
using Microsoft.Extensions.DependencyInjection;
using T = System.Threading.Tasks;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Firely.Server.MessageSender;

public static class Program
{
    static async T.Task Main(string[] args) 
    {
        var host = Host.CreateDefaultBuilder(args)
            .ConfigureServices(services =>
            {  
                services.AddTransient<UserInputProcessor>();
                services.AddTransient<PubSubClient>(sp => new PubSubClient(sp.GetRequiredService<IBus>(), FhirRelease.R4));
                
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
                            .AddOtlpExporter(o =>
                            {
                                o.Endpoint = new Uri("http://localhost:4317");
                            })
                    );
                
                services.AddMassTransit(configurator =>
                {
                    configurator.AddConsumer<ResourcesChangedConsumer>();
                    configurator.AddConsumer<ResourcesChangedLightConsumer>();
                    
                    configurator
                        .UsingRabbitMq((context, cfg) =>
                        {
                            cfg.UseJsonSerializer();
                            cfg.ConfigureJsonSerializerOptions(o =>
                            {
                                o.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, false));
                                return o;
                            });
                            
                            cfg.ReceiveEndpoint("dotnet-resource-change", e =>
                            {
                                e.ConfigureConsumer<ResourcesChangedConsumer>(context);
                            });
                            cfg.ReceiveEndpoint("dotnet-resource-change-light", e =>
                            {
                                e.ConfigureConsumer<ResourcesChangedLightConsumer>(context);
                            });
                        });
                });
            })
            .Build();

        var service = host.Services.GetRequiredService<UserInputProcessor>();
        _ = service.ProcessUserInput();
        
        await host.RunAsync();
    }   
}
