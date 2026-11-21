:- module(json_boundary, [write_planning_json/2, validate_json_numbers/1]).

:- use_module(library(http/json)).
:- use_module(library(apply)).
:- use_module(library(lists)).

%! write_planning_json(+Stream, +Response) is det.
%
% Shared output boundary for the demo and future AI05 handlers. Validate every
% integer before writing, so rejection cannot leave a partial JSON document.
write_planning_json(Stream, Response) :-
    catch(
        ( json_safe_integers(Response, "$"), SafeResponse = Response ),
        error(json_integer_range(Path, Decimal), _),
        range_error_response(Response, Path, Decimal, SafeResponse)
    ),
    json_write_dict(Stream, SafeResponse, [width(100)]).

% Readers can enforce the same transport range before retaining source JSON.
validate_json_numbers(Document) :- json_safe_integers(Document, "$").

range_error_response(Response, Path, Decimal, SafeResponse) :-
    Diagnostic0 = _{
        code:"JSON_INTEGER_OUT_OF_RANGE", field:Path, value:Decimal,
        message:"Integer exceeds the JavaScript safe range (-9007199254740991 to 9007199254740991)."},
    foldl(copy_context(Response), [scenarioId, executionId], _{}, Context),
    put_dict(Context, Diagnostic0, Diagnostic),
    put_dict(error, Context, Diagnostic, SafeResponse).

% Retain only valid string references; other rejected metadata cannot leak back
% into the error response as another unsafe JSON number.
copy_context(Response, Key, Before, After) :-
    ( is_dict(Response), get_dict(Key, Response, Value),
      string(Value), string_length(Value, Length), Length > 0 ->
        put_dict(Key, Before, Value, After)
    ; After = Before
    ).

json_safe_integers(Value, Path) :-
    ( integer(Value) ->
        ( Value >= -9007199254740991, Value =< 9007199254740991 -> true
        ; number_string(Value, Decimal),
          throw(error(json_integer_range(Path, Decimal), _))
        )
    ; is_dict(Value) ->
        dict_pairs(Value, _, Pairs),
        forall(member(Key-Child, Pairs),
               ( format(string(ChildPath), '~s.~w', [Path, Key]),
                 json_safe_integers(Child, ChildPath) ))
    ; is_list(Value) ->
        json_safe_list(Value, Path, 0)
    ; true
    ).

json_safe_list([], _, _).
json_safe_list([Value|Values], Path, Index) :-
    format(string(ChildPath), '~s[~d]', [Path, Index]),
    json_safe_integers(Value, ChildPath),
    Next is Index + 1,
    json_safe_list(Values, Path, Next).
