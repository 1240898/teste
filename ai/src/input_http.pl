:- module(input_http, [input_service_config/1, input_http/7, path_id/3]).
:- use_module(library(http/http_open)).
:- use_module(library(http/http_json)).
:- use_module(library(http/json)).
:- use_module(library(http/http_ssl_plugin)).
:- use_module(library(uri)).
:- use_module(library(utf8)).
:- use_module(input_validation).
:- use_module(json_boundary, [validate_json_numbers/1]).

input_service_config(service{baseUrl:Base,readToken:Read,recordsToken:Records,timeout:10}) :-
    env_value('LAPRIZZA_INPUT_API_URL',Base),
    env_value('LAPRIZZA_INPUT_READ_TOKEN',Read),
    env_value('LAPRIZZA_INPUT_RECORDS_TOKEN',Records).
env_value(Name, Value) :-
    ( getenv(Name,Atom),Atom\=='' -> atom_string(Atom,Value)
    ; input_error("SERVICE_CONFIG_MISSING","configuration",Name,"Missing AI06 service configuration.") ).

input_http(Config, Permission, Method, Path, Body, Status, Response) :-
    validate_config(Config),
    ( Permission == records -> required(Config,recordsToken,Token) ; required(Config,readToken,Token) ),
    string_concat("Bearer ",Token,Header),
    required(Config,baseUrl,Base), string_concat(Base,Path,Url),
    optional(Config,timeout,Configured), (Configured==none -> Timeout=10 ; Timeout=Configured),
    Options = [method(Method),request_header('Authorization'=Header),
               timeout(Timeout),max_redirect(0),status_code(Status)],
    ( (Method==post ; Method==put) -> WithBody=[post(json(Body))|Options] ; WithBody=Options ),
    catch(setup_call_cleanup(http_open(Url,Stream,WithBody),
                            read_response(Stream,Status,Response),close(Stream)),
          error(Formal,_), http_failure(Formal)).

validate_config(Config) :-
    required(Config,baseUrl,Base),
    require((string(Base),uri_components(Base,Parts),uri_data(scheme,Parts,Scheme),
             uri_data(authority,Parts,Authority),uri_authority_components(Authority,AP),
             uri_authority_data(host,AP,Host),uri_authority_data(user,AP,User),var(User),
             (Scheme==https ; Scheme==http,memberchk(Host,['127.0.0.1',localhost,'[::1]'])),
             \+ sub_string(Base,_,1,0,"/")),
            "INVALID_SERVICE_URL","configuration",none,"Use HTTPS, or HTTP on loopback for a local demonstration.").

read_response(_,204,json{}) :- !.
read_response(Stream,_,Response) :-
    set_stream(Stream,encoding(octet)),
    read_string(Stream,4194305,BytesText), string_length(BytesText,Length),
    require(Length=<4194304,"INVALID_SOURCE_RESPONSE","response",none,"Input response is too large."),
    string_codes(BytesText,Bytes),
    require(phrase(utf8_codes(Codes),Bytes),"INVALID_SOURCE_RESPONSE","response",none,"Expected UTF-8 JSON."),
    string_codes(Text,Codes),
    catch(atom_json_dict(Text,Response,[default_tag(json)]),_,
          input_error("INVALID_SOURCE_RESPONSE","response",none,"The source did not return valid JSON.")),
    require(is_dict(Response),"INVALID_SOURCE_RESPONSE","response",none,"Expected a JSON object."),
    catch(validate_json_numbers(Response),error(json_integer_range(Path,Decimal),_),
          input_error("JSON_INTEGER_OUT_OF_RANGE",Path,Decimal,"Source integer cannot safely round-trip through JSON.")).

http_failure(planning_input(Diagnostic)) :- !, throw(error(planning_input(Diagnostic),_)).
http_failure(_) :- input_error("INPUT_SOURCE_UNAVAILABLE","http",none,
                              "The planning source could not be reached securely or timed out.").

path_id(Prefix,Id,Path) :-
    identifier(Id,"path"),uri_encoded(query_value,Id,Encoded),
    atomics_to_string([Prefix,Encoded],Path).
