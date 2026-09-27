using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;
using EduAI.Court.Protocol;

namespace EduAI.Court.Networking
{
    // Closed public protocol, not a general JSON parser. Validate before JsonUtility
    // (which otherwise silently ignores unknown fields and supplies missing values).
    public static class CourtWire
    {
        public const int MaxBytes = 262144;
        private static readonly Dictionary<string,string> Shapes = new Dictionary<string,string> {
            {"snapshot", "apiVersion:v requestId:s caseId:s sessionId:s stateVersion:n eventId:s eventSequence:n timestamp:s state:state"},
            {"event", "apiVersion:v requestId:s caseId:s sessionId:s stateVersion:n eventId:s eventSequence:n timestamp:s kind:s speaker:s roleId:s stageId:s text:s evidenceIds:s[] citationIds:s[] snapshot:snapshot"},
            {"mutation", "apiVersion:v requestId:s idempotencyKey:s sessionId:s caseId:s expectedStateVersion:n actionId:s targetId:s text:s"},
            {"state", "title:s procedure:s roleId:s stageId:s stageLabel:s completed:b allowedActions:action[] npcs:npc[] evidence:evidence[] feedback:s"},
            {"action", "actionId:s label:s category:s enabled:b reasonDisabled:s requiredTarget:s"},
            {"npc", "npcId:s roleId:s displayName:s seatId:s pose:s emotion:s speakingState:s visible:b interactable:b requestState:s"},
            {"evidence", "evidenceId:s title:s type:s text:s metadata:metadata[] sourceRole:s admittedStatus:s presentationState:s factReferences:s[] assetId:s"},
            {"metadata", "name:s value:s"}
        };
        public static CourtSnapshot Snapshot(string raw) => Read<CourtSnapshot>(raw,"snapshot",CourtProjectionValidator.Valid);
        public static CourtEvent Event(string raw) => Read<CourtEvent>(raw,"event",CourtProjectionValidator.Valid);
        public static CourtMutation Mutation(string raw) => Read<CourtMutation>(raw,"mutation",CourtProjectionValidator.Valid);
        private static T Read<T>(string raw,string shape,Func<T,bool> valid) where T:class
        {
            if(raw==null || raw.Length>MaxBytes) return null;
            try {
                if(new UTF8Encoding(false,true).GetByteCount(raw)>MaxBytes) return null;
                var parser=new Reader(raw); parser.Value(shape,0); parser.End();
                var value=JsonUtility.FromJson<T>(raw);
                return valid(value)?value:null;
            } catch(FormatException) { return null; }
              catch(ArgumentException) { return null; }
        }
        private sealed class Reader
        {
            private readonly string raw;
            private int at, nodes;
            public Reader(string value){raw=value;}
            private void Bad(){throw new FormatException("Invalid court payload");}
            private void Space(){while(at<raw.Length && (raw[at]==' '||raw[at]=='\r'||raw[at]=='\n'||raw[at]=='\t'))at++;}
            private bool Take(char c){Space();if(at<raw.Length&&raw[at]==c){at++;return true;}return false;}
            private void Need(char c){if(!Take(c))Bad();}
            public void End(){Space();if(at!=raw.Length)Bad();}
            public void Value(string shape,int depth)
            {
                if(depth>12||++nodes>10000)Bad();
                Space();
                if(shape=="s"){String();return;}
                if(shape=="b"){
                    if(at+4<=raw.Length&&raw.Substring(at,4)=="true"){at+=4;return;}
                    if(at+5<=raw.Length&&raw.Substring(at,5)=="false"){at+=5;return;}
                    Bad();
                }
                if(shape=="n"||shape=="v"){
                    int start=at;while(at<raw.Length&&raw[at]>='0'&&raw[at]<='9')at++;
                    if(start==at || at-start>16 || (at-start>1&&raw[start]=='0'))Bad();
                    if(!long.TryParse(raw.Substring(start,at-start),NumberStyles.None,CultureInfo.InvariantCulture,out long n)||n>CourtProjectionValidator.MaxSafeInteger)Bad();
                    if(shape=="v"&&n!=1)Bad();
                    return;
                }
                if(shape.EndsWith("[]",StringComparison.Ordinal)){
                    Need('[');int count=0;if(Take(']'))return;
                    do {if(++count>40)Bad();Value(shape.Substring(0,shape.Length-2),depth+1);}while(Take(','));
                    Need(']');return;
                }
                Need('{');var fields=Shapes[shape].Split(' ');var seen=new HashSet<string>(StringComparer.Ordinal);
                if(!Take('}')){
                    do {
                        string key=String();if(!seen.Add(key))Bad();Need(':');
                        string expected=null;
                        foreach(var field in fields){int split=field.IndexOf(':');if(field.Substring(0,split)==key){expected=field.Substring(split+1);break;}}
                        if(expected==null)Bad();Value(expected,depth+1);
                    }while(Take(','));
                    Need('}');
                }
                if(seen.Count!=fields.Length)Bad();
            }
            private string String()
            {
                Need('"');var output=new StringBuilder();bool closed=false;
                while(at<raw.Length){
                    char c=raw[at++];if(c=='"'){closed=true;break;}if(c<32)Bad();
                    if(c=='\\'){
                        if(at>=raw.Length)Bad();c=raw[at++];
                        switch(c){
                            case '"': case '\\': case '/': break;
                            case 'b':c='\b';break;case 'f':c='\f';break;case 'n':c='\n';break;case 'r':c='\r';break;case 't':c='\t';break;
                            case 'u':
                                if(at+4>raw.Length||!ushort.TryParse(raw.Substring(at,4),NumberStyles.AllowHexSpecifier,CultureInfo.InvariantCulture,out ushort hex)) {Bad();return null;}
                                c=(char)hex;at+=4;break;
                            default:Bad();break;
                        }
                    }
                    output.Append(c);if(output.Length>12000)Bad();
                }
                if(!closed)Bad();
                string value=output.ToString();
                for(int i=0;i<value.Length;i++){
                    if(char.IsHighSurrogate(value[i])){if(++i>=value.Length||!char.IsLowSurrogate(value[i]))Bad();}
                    else if(char.IsLowSurrogate(value[i]))Bad();
                }
                return value;
            }
        }
    }
}
