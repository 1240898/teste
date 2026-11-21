:- begin_tests(input_mapper).
:- use_module('../src/input_mapper').
:- use_module('../src/input_validation').
:- use_module('../src/input_http').
:- use_module(library(http/json)).

test(exact_eur_cents, [forall(member(Text-Expected,["8.50"-850,"8.5"-850,"8"-800,"0.00"-0,"75.00"-7500]))]) :-
    price_cents(Text,Cents),assertion(Cents==Expected).
test(invalid_prices, [forall(member(Text,[8.50,"-1.00","8.500","1e2","8.",".50","NaN"]))]) :-
    catch(price_cents(Text,_),error(planning_input(D),_),true),assertion(D.code=="INVALID_PRICE").
test(calendar_dates, [forall(member(Text-Date,["2028-02-29"-date(2028,2,29),"2026-11-20"-date(2026,11,20)]))]) :-
    date_value(Text,Actual),assertion(Actual==Date).
test(invalid_dates, [forall(member(Text,["2026-02-29","2026-13-01","2026-aa-01","2026-1-01","2026-11-31"]))]) :-
    catch(date_value(Text,_),error(planning_input(D),_),true),assertion(D.code=="INVALID_DATE").
test(json_tag_is_not_selection_identity) :-
    assertion(same_json(execution{id:"x",source:source{version:"1"}},json{id:"x",source:json{version:"1"}})),
    assertion(\+same_json(json{id:"x"},json{id:"y"})).
test(production_url_requires_https) :-
    catch(input_http:validate_config(service{baseUrl:"http://example.invalid/api/v1"}),error(planning_input(D),_),true),
    assertion(D.code=="INVALID_SERVICE_URL").
test(local_demo_http_is_explicitly_allowed) :-
    input_http:validate_config(service{baseUrl:"http://127.0.0.1:8080/api/v1"}).
test(supplier_selection_excludes_internal_production_and_untracked_items) :-
    supplier_product_ids([item("dough",aggregate,true,produced,"unit",none),
                         item("pesto",aggregate,true,purchased,"g",none),
                         item("flour",terminal,true,purchased,"g",none),
                         item("label",terminal,false,none,none,none)],Ids),
    assertion(Ids==["flour","pesto"]).

provenance_example(Selection,View) :-
    Time="2026-11-20T12:34:56.000Z",
    Selection=json{calculation:"BOM",demand:json{type:"order",id:"ORDER-1"},
                   catalogue:json{type:"current"},stock:json{type:"current"}},
    View=json{retrievedAt:Time,provenance:[
      json{dataset:"demand",source:"ORDER-1",retrievedAt:Time,simulated:false},
      json{dataset:"catalogue",source:"backoffice",retrievedAt:Time,simulated:false},
      json{dataset:"stock",source:"backoffice",retrievedAt:Time,simulated:false}]}.

test(current_source_provenance_uses_capture_time) :-
    provenance_example(Selection,View),
    input_mapper:validate_input_provenance(Selection,View,[],Provenance),
    assertion(Provenance==View.provenance).

test(current_source_provenance_rejects_a_different_retrieval_time) :-
    provenance_example(Selection,View),View.provenance=[Demand,Catalogue,Stock],
    Changed=Stock.put(retrievedAt,"2026-11-20T12:35:00.000Z"),
    catch(input_mapper:validate_input_provenance(Selection,View.put(provenance,[Demand,Catalogue,Changed]),[],_),
      error(planning_input(Diagnostic),_),true),
    assertion(Diagnostic.code=="INVALID_PROVENANCE"),assertion(Diagnostic.reference=="stock").

test(selected_preparations_need_their_own_provenance) :-
    provenance_example(Base,View),Selection=Base.put(preparationFixture,json{id:"dough",version:"1"}),
    catch(input_mapper:validate_input_provenance(Selection,View,[],_),error(planning_input(Diagnostic),_),true),
    assertion(Diagnostic.code=="MISSING_PROVENANCE"),assertion(Diagnostic.reference=="recipes").

:- end_tests(input_mapper).
