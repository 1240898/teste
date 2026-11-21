:- module(demo_bom, [demo/1, demo_stock/1]).

:- use_module(src/bom).
:- use_module(src/json_boundary).
:- use_module(fixtures/bom_fixtures).

%! demo(+Name) is det.
%
% Local demonstration boundary for AI05/AI06. The real adapter will supply
% the same input and wrap bom_requirements/2 with execution and access handling.
demo(Name) :-
    bom_fixture(Name, Input),
    bom_requirements(Input, Outcome),
    demo_response(Outcome, Input.meta, Response),
    write_planning_json(current_output, Response),
    nl.

demo_response(ok(Lines), Meta, Response) :-
    Response = Meta.put(lines, Lines).
demo_response(error(Diagnostic), Meta, Response) :-
    Response = Meta.put(error, Diagnostic).

%! demo_stock(+Name) is det.
% Print the withdrawal and replenishment lists used in the IARTI example.
demo_stock(Name) :-
    bom_fixture(Name, Input),
    bom_requirements(Input, Outcome),
    print_stock_outcome(Outcome).

print_stock_outcome(ok(Lines)) :-
    stock_lists(Lines, Withdraw, Order),
    write('LWS='), write_term(Withdraw, [quoted(true)]), nl,
    write('LOS='), write_term(Order, [quoted(true)]), nl.
print_stock_outcome(error(Diagnostic)) :-
    write_planning_json(current_output, Diagnostic), nl.
