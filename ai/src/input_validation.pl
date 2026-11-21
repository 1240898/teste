:- module(input_validation, [input_error/4, required/3, require/5, identifier/2,
    units/2, positive_units/2, optional/3, input_list/3, date_value/2, unique/3,
    same_json/2]).
:- use_module(library(date)).
:- meta_predicate require(0,+,+,+,+).

input_error(Code, Field, Reference, Message) :-
    throw(error(planning_input(diagnostic{code:Code,field:Field,reference:Reference,message:Message}), _)).
require(Goal, Code, Field, Reference, Message) :-
    ( call(Goal) -> true ; input_error(Code,Field,Reference,Message) ).
required(Dict, Key, Value) :-
    ( is_dict(Dict), get_dict(Key,Dict,Value) -> true
    ; atom_string(Key,Field), input_error("MISSING_FIELD",Field,none,"Required input field is missing.") ).
optional(Dict, Key, Value) :-
    ( get_dict(Key,Dict,Given), Given \== null -> Value=Given ; Value=none ).
identifier(Value, Field) :-
    require((string(Value),string_length(Value,N),N>0),"INVALID_REFERENCE",Field,Value,"Expected a non-empty identifier string.").
units(Value, Field) :-
    require((integer(Value),Value>=0),"INVALID_QUANTITY",Field,Value,"Expected a non-negative integer.").
positive_units(Value, Field) :-
    units(Value,Field), require(Value>0,"INVALID_QUANTITY",Field,Value,"Expected a positive integer.").
input_list(Dict, Key, List) :-
    required(Dict,Key,List), atom_string(Key,Field),
    require(is_list(List),"INVALID_INPUT",Field,none,"Expected a JSON array.").
date_value(Text,date(Y,M,D)) :-
    require((string(Text),split_string(Text,"-","",[YS,MS,DS]),
             string_length(YS,4),string_length(MS,2),string_length(DS,2),
             digits(YS),digits(MS),digits(DS),
             number_string(Y,YS),number_string(M,MS),number_string(D,DS),
             integer(Y),between(1,9999,Y),integer(M),between(1,12,M),integer(D),
             catch(date_time_stamp(date(Y,M,D,0,0,0,0,-,-),Stamp),_,fail),
             stamp_date_time(Stamp,date(Y,M,D,_,_,_,_,_,_),0)),
            "INVALID_DATE","date",Text,"Expected a valid YYYY-MM-DD calendar date.").
digits(Text) :- string_codes(Text,Codes),forall(member(C,Codes),between(0'0,0'9,C)).
unique(Ids, Field, Reference) :-
    sort(Ids,Sorted), length(Ids,N), length(Sorted,M),
    require(N=:=M,"DUPLICATE_REFERENCE",Field,Reference,"Duplicate identities are not allowed.").

% JSON object tags are an SWI detail, not part of a selection's identity.
same_json(A,B) :-
    ( is_dict(A), is_dict(B) -> dict_pairs(A,_,AP),dict_pairs(B,_,BP),same_pairs(AP,BP)
    ; is_list(A),is_list(B) -> same_values(A,B)
    ; A == B ).
same_pairs([],[]).
same_pairs([K-A|As],[K-B|Bs]) :- same_json(A,B),same_pairs(As,Bs).
same_values([],[]).
same_values([A|As],[B|Bs]) :- same_json(A,B),same_values(As,Bs).
