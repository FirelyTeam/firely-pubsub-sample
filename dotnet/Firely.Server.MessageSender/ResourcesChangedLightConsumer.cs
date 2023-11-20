using System.Threading.Tasks;
using Firely.Server.Contracts.Messages.V1;
using MassTransit;
using Microsoft.Extensions.Logging;
namespace Firely.Server.MessageSender;

internal class ResourcesChangedLightConsumer :  IConsumer<ResourcesChangedLightEvent>
{
    private readonly ILogger<ResourcesChangedConsumer> _logger;
    
    public ResourcesChangedLightConsumer(ILogger<ResourcesChangedConsumer> logger)
    {
        _logger = logger;
    }

    public Task Consume(ConsumeContext<ResourcesChangedLightEvent> context)
    {
        if (context.Message is { } changes)
        {
            _logger.LogInformation($"Received changed light event: {changes}.");
        }

        return Task.CompletedTask;
    }
}