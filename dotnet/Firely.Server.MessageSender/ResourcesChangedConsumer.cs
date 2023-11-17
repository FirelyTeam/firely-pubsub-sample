using System.Threading.Tasks;
using Firely.Server.Contracts.Messages.V1;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace Firely.Server.MessageSender;

internal class ResourcesChangedConsumer :  IConsumer<ResourcesChangedEvent>
{
    private readonly ILogger<ResourcesChangedConsumer> _logger;
    
    public ResourcesChangedConsumer(ILogger<ResourcesChangedConsumer> logger)
    {
        _logger = logger;
    }
    
    public Task Consume(ConsumeContext<ResourcesChangedEvent> context)
    {
        if (context.Message is { } changes)
        {
            _logger.LogInformation($"Received changed event: {changes}.");
        }

        return Task.CompletedTask;
    }
}
