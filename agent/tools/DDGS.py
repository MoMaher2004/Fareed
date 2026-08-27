from ddgs import DDGS
from pydantic import BaseModel, Field
from langchain_core.tools import tool

class Search(BaseModel):
    """Use it whenever you want to search on web. Use only required fields unless you have instructions to use optional fields."""
    query: str = Field(..., description="The subject or keywords to search.")
    region: str = Field(description="The reigon for search. Its value can be a key from the following object [{'xa-ar': 'Arabia'}, {'xa-en': 'Arabia (en)'}, {'ar-es': 'Argentina'}, {'au-en': 'Australia'}, {'at-de': 'Austria'}, {'be-fr': 'Belgium (fr)'}, {'be-nl': 'Belgium (nl)'}, {'br-pt': 'Brazil'}, {'bg-bg': 'Bulgaria'}, {'ca-en': 'Canada'}, {'ca-fr': 'Canada (fr)'}, {'ct-ca': 'Catalan'}, {'cl-es': 'Chile'}, {'cn-zh': 'China'}, {'co-es': 'Colombia'}, {'hr-hr': 'Croatia'}, {'cz-cs': 'Czech Republic'}, {'dk-da': 'Denmark'}, {'ee-et': 'Estonia'}, {'fi-fi': 'Finland'}, {'fr-fr': 'France'}, {'de-de': 'Germany'}, {'gr-el': 'Greece'}, {'hk-tzh': 'Hong Kong'}, {'hu-hu': 'Hungary'}, {'in-en': 'India'}, {'id-id': 'Indonesia'}, {'id-en': 'Indonesia (en)'}, {'ie-en': 'Ireland'}, {'il-he': 'Israel'}, {'it-it': 'Italy'}, {'jp-jp': 'Japan'}, {'kr-kr': 'Korea'}, {'lv-lv': 'Latvia'}, {'lt-lt': 'Lithuania'}, {'xl-es': 'Latin America'}, {'my-ms': 'Malaysia'}, {'my-en': 'Malaysia (en)'}, {'mx-es': 'Mexico'}, {'nl-nl': 'Netherlands'}, {'nz-en': 'New Zealand'}, {'no-no': 'Norway'}, {'pe-es': 'Peru'}, {'ph-en': 'Philippines'}, {'ph-tl': 'Philippines (tl)'}, {'pl-pl': 'Poland'}, {'pt-pt': 'Portugal'}, {'ro-ro': 'Romania'}, {'ru-ru': 'Russia'}, {'sg-en': 'Singapore'}, {'sk-sk': 'Slovak Republic'}, {'sl-sl': 'Slovenia'}, {'za-en': 'South Africa'}, {'es-es': 'Spain'}, {'se-sv': 'Sweden'}, {'ch-de': 'Switzerland (de)'}, {'ch-fr': 'Switzerland (fr)'}, {'ch-it': 'Switzerland (it)'}, {'tw-tzh': 'Taiwan'}, {'th-th': 'Thailand'}, {'tr-tr': 'Turkey'}, {'ua-uk': 'Ukraine'}, {'uk-en': 'United Kingdom'}, {'us-en': 'United States'}, {'ue-es': 'United States (es)'}, {'ve-es': 'Venezuela'}, {'vn-vi': 'Vietnam'}, {'wt-wt': 'No region'}]")
    safesearch: str = Field(description="How much the search is safe from pornography. Its value can be one of the following [on, moderate, off]")
    timelimit: str = Field(description="It is the time limit for when the results must be afer that limit. Its value can be a key of the folloing object [{'d', 'day'}, {'w', 'weak'}, {'m', 'month'}, {'y', 'year'}]")
    max_results: int = Field(description="The maximum number of results")
    page: int = Field(description="The page number of results")
    backend: str = Field(description="The backend used to get results. Its value can be ['bing', 'brave', 'duckduckgo', 'google', 'grokipedia', 'mojeek', 'yandex', 'yahoo', 'wikipedia', 'auto'] for normal search but can be ['bing', 'duckduckgo', 'yahoo', 'auto'] for news search.")
    newsSearch: bool = Field(description="This field distinguish between normal search and news search. For news search its value is True")

@tool(args_schema=Search)
async def search(
    query: str,
    region: str | None = None,
    safesearch: str = "off",
    timelimit: str | None = None,
    max_results: int = 15,
    page: int = 1,
    backend: str = 'auto',
    newsSearch: bool = False,
) -> list[dict]:
    if newsSearch: return await DDGS().news(query=query, page=page, backend=backend, region=region, safesearch=safesearch, timelimit=timelimit, max_results=max_results)
    else: return DDGS().text(query=query, page=page, backend=backend, region=region, safesearch=safesearch, timelimit=timelimit, max_results=max_results)
