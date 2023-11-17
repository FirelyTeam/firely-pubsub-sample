using System;
using System.Collections.Generic;
using System.Linq;
using Firely.Server.Contracts.Messages.V1;
using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;
using ResourceReference = Firely.Server.Contracts.Messages.V1.ResourceReference;

namespace Firely.Server.MessageSender;

public static class CommandProcessor
{
    
    public static RetrievePlanItem BuildRetrievePlanItem(IEnumerable<string> args)
    {
        var (id, version) = get2(args);

        var reference = new ResourceReference("Patient", id!, version);
        return new RetrievePlanItem(MakeId(id!), reference);
    }
    
    public static StorePlanItem? BuildStorePlanItem(string command, IEnumerable<string> args)
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

    private static (string?, string?, string?, string?) get4(IEnumerable<string> args)
    {
        return Get(args, (t1, a1) =>
            Get(t1, (t2, a2) =>
                Get(t2, (t3, a3) =>
                    Get(t3, (_, a4) =>
                    (a1, a2, a3, a4)))));
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
        var (family, id, newVid, currentVid) = get4(args);

        var p = new Patient { 
            Id = id, 
            Meta = new() { VersionId = newVid, LastUpdated = DateTimeOffset.Now},
            Name = { new HumanName { Family = family }}
        };

        return new StorePlanItem(MakeId(id!), p.ToJson(), p.TypeName, p.Id, currentVid,
            upsert ? StorePlanItemOperation.Upsert : StorePlanItemOperation.Update);
    }
    
    private static StorePlanItem DeletePatient(IEnumerable<string> args)
    {
        var (id, currentVersion) = get2(args);

        return new StorePlanItem(MakeId(id!), null, "Patient", id, currentVersion, StorePlanItemOperation.Delete);
    }
}